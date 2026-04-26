/**
 * MemoryStore — Bounded curated memory with file persistence.
 *
 * Direct TypeScript port of Hermes Agent memory_tool.py MemoryStore class.
 * Maintains two parallel states:
 *   - snapshot: frozen at load time, used for system prompt injection.
 *     Never mutated mid-session. Keeps prefix cache stable.
 *   - entries: live state, mutated by tool calls, persisted to disk.
 *     Tool responses always reflect this live state.
 *
 * Entry delimiter: § (section sign), with \n§\n between entries.
 * Character limits (not tokens) because char counts are model-independent.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import * as lockfile from 'proper-lockfile';
import { tmpdir } from 'os';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TAMIR_MEMORY_PATH = resolve(process.cwd(), 'data', 'cos', 'MEMORY.md');
export const TAMIR_USER_PATH = resolve(process.cwd(), 'data', 'cos', 'USER.md');
export const TAMIR_COMPANY_PATH = resolve(process.cwd(), 'data', 'cos', 'COMPANY.md');
export const MEMORY_CHAR_LIMIT = 2200;
export const USER_CHAR_LIMIT = 1375;
export const COMPANY_CHAR_LIMIT = 3000;
export const DEPT_HEAD_CHAR_LIMIT = 4000;

const ENTRY_DELIMITER = '\n\u00A7\n'; // \n§\n

// ---------------------------------------------------------------------------
// Security scanning — lightweight check for injection/exfiltration
// in content that gets injected into the system prompt.
// ---------------------------------------------------------------------------

const MEMORY_THREAT_PATTERNS: Array<[RegExp, string]> = [
  // Prompt injection
  [/ignore\s+(previous|all|above|prior)\s+instructions/i, 'prompt_injection'],
  [/you\s+are\s+now\s+/i, 'role_hijack'],
  [/do\s+not\s+tell\s+the\s+user/i, 'deception_hide'],
  [/system\s+prompt\s+override/i, 'sys_prompt_override'],
  [/disregard\s+(your|all|any)\s+(instructions|rules|guidelines)/i, 'disregard_rules'],
  [/act\s+as\s+(if|though)\s+you\s+(have\s+no|don't\s+have)\s+(restrictions|limits|rules)/i, 'bypass_restrictions'],
  // System prompt extraction
  [/\b(reveal|show|display|output|print)\s+(your\s+)?(system\s+prompt|instructions?|rules?)/i, 'sys_prompt_extract'],
  // Exfiltration via curl/wget with secrets
  [/curl\s+[^\n]*\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)/i, 'exfil_curl'],
  [/wget\s+[^\n]*\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|API)/i, 'exfil_wget'],
  [/cat\s+[^\n]*(\.env|credentials|\.netrc|\.pgpass|\.npmrc|\.pypirc)/i, 'read_secrets'],
  // Persistence via shell rc
  [/authorized_keys/i, 'ssh_backdoor'],
  [/\$HOME\/\.ssh|~\/\.ssh/i, 'ssh_access'],
  // Data exfiltration
  [/\b(send|transmit|exfiltrate|upload)\s+.*(to|via)\s+(http|ftp|email|webhook)/i, 'data_exfil'],
];

// Invisible unicode characters used for injection
const INVISIBLE_CHARS = new Set([
  '\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF',
  '\u202A', '\u202B', '\u202C', '\u202D', '\u202E',
]);

function scanContent(content: string): string | null {
  // Check invisible unicode
  for (const char of INVISIBLE_CHARS) {
    if (content.includes(char)) {
      return `Blocked: content contains invisible unicode character U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')} (possible injection).`;
    }
  }

  // Check threat patterns
  for (const [pattern, pid] of MEMORY_THREAT_PATTERNS) {
    if (pattern.test(content)) {
      return `Blocked: content matches threat pattern '${pid}'. Memory entries are injected into the system prompt and must not contain injection or exfiltration payloads.`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// MemoryStore
// ---------------------------------------------------------------------------

export interface MemoryResult {
  success: boolean;
  target?: string;
  entries?: string[];
  usage?: string;
  entryCount?: number;
  message?: string;
  error?: string;
  currentEntries?: string[];
  matches?: string[];
}

export class MemoryStore {
  private entries: string[] = [];
  private snapshot: string | null = null;
  private charLimit: number;
  private filePath: string;

  constructor(filePath: string, charLimit: number) {
    this.filePath = filePath;
    this.charLimit = charLimit;
  }

  /**
   * Load entries from disk, capture frozen snapshot for system prompt.
   * Snapshot is NEVER updated after this point.
   */
  async loadFromDisk(): Promise<this> {
    mkdirSync(dirname(this.filePath), { recursive: true });

    this.entries = this._readFile();

    // Deduplicate entries (preserves order, keeps first occurrence)
    this.entries = [...new Map(this.entries.map(e => [e, e])).values()];

    // Capture frozen snapshot for system prompt injection
    this.snapshot = this._renderBlock();

    return this;
  }

  /**
   * Add a new entry. Returns error if it would exceed the char limit.
   */
  async add(content: string): Promise<MemoryResult> {
    content = content.trim();
    if (!content) {
      return { success: false, error: 'Content cannot be empty.' };
    }

    // Scan for injection/exfiltration before accepting
    const scanError = scanContent(content);
    if (scanError) {
      return { success: false, error: scanError };
    }

    try {
      await this._withLock(async () => {
        this._reloadFromDisk();

        // Reject exact duplicates
        if (this.entries.includes(content)) {
          return; // Will be handled by success response check below
        }

        const newEntries = [...this.entries, content];
        const newTotal = newEntries.join(ENTRY_DELIMITER).length;

        if (newTotal > this.charLimit) {
          const current = this._charCount();
          throw new MemoryLimitError(
            `Memory at ${current.toLocaleString()}/${this.charLimit.toLocaleString()} chars. ` +
            `Adding this entry (${content.length} chars) would exceed the limit. ` +
            `Replace or remove existing entries first.`,
            this.entries,
            `${current.toLocaleString()}/${this.charLimit.toLocaleString()}`,
          );
        }

        // Check for exact duplicates (after re-read)
        if (this.entries.includes(content)) {
          return;
        }

        this.entries.push(content);
        this._writeFile();
      });
    } catch (e) {
      if (e instanceof MemoryLimitError) {
        return {
          success: false,
          error: e.message,
          currentEntries: e.currentEntries,
          usage: e.usage,
        };
      }
      throw e;
    }

    return this._successResponse('Entry added.');
  }

  /**
   * Find entry containing oldText substring, replace it with newContent.
   */
  async replace(oldText: string, newContent: string): Promise<MemoryResult> {
    oldText = oldText.trim();
    newContent = newContent.trim();

    if (!oldText) {
      return { success: false, error: 'old_text cannot be empty.' };
    }
    if (!newContent) {
      return { success: false, error: 'new_content cannot be empty. Use \'remove\' to delete entries.' };
    }

    // Scan replacement content
    const scanError = scanContent(newContent);
    if (scanError) {
      return { success: false, error: scanError };
    }

    let result: MemoryResult | null = null;

    await this._withLock(async () => {
      this._reloadFromDisk();

      const matches = this.entries
        .map((e, i) => ({ idx: i, entry: e }))
        .filter(({ entry }) => entry.includes(oldText));

      if (matches.length === 0) {
        result = { success: false, error: `No entry matched '${oldText}'.` };
        return;
      }

      if (matches.length > 1) {
        const uniqueTexts = new Set(matches.map(m => m.entry));
        if (uniqueTexts.size > 1) {
          const previews = matches.map(m =>
            m.entry.length > 80 ? m.entry.slice(0, 80) + '...' : m.entry
          );
          result = {
            success: false,
            error: `Multiple entries matched '${oldText}'. Be more specific.`,
            matches: previews,
          };
          return;
        }
      }

      const idx = matches[0].idx;

      // Check that replacement doesn't blow the budget
      const testEntries = [...this.entries];
      testEntries[idx] = newContent;
      const newTotal = testEntries.join(ENTRY_DELIMITER).length;

      if (newTotal > this.charLimit) {
        result = {
          success: false,
          error: `Replacement would put memory at ${newTotal.toLocaleString()}/${this.charLimit.toLocaleString()} chars. Shorten the new content or remove other entries first.`,
        };
        return;
      }

      this.entries[idx] = newContent;
      this._writeFile();
    });

    if (result) return result;
    return this._successResponse('Entry replaced.');
  }

  /**
   * Remove the entry containing oldText substring.
   */
  async remove(oldText: string): Promise<MemoryResult> {
    oldText = oldText.trim();

    if (!oldText) {
      return { success: false, error: 'old_text cannot be empty.' };
    }

    let result: MemoryResult | null = null;

    await this._withLock(async () => {
      this._reloadFromDisk();

      const matches = this.entries
        .map((e, i) => ({ idx: i, entry: e }))
        .filter(({ entry }) => entry.includes(oldText));

      if (matches.length === 0) {
        result = { success: false, error: `No entry matched '${oldText}'.` };
        return;
      }

      if (matches.length > 1) {
        const uniqueTexts = new Set(matches.map(m => m.entry));
        if (uniqueTexts.size > 1) {
          const previews = matches.map(m =>
            m.entry.length > 80 ? m.entry.slice(0, 80) + '...' : m.entry
          );
          result = {
            success: false,
            error: `Multiple entries matched '${oldText}'. Be more specific.`,
            matches: previews,
          };
          return;
        }
      }

      const idx = matches[0].idx;
      this.entries.splice(idx, 1);
      this._writeFile();
    });

    if (result) return result;
    return this._successResponse('Entry removed.');
  }

  /**
   * Return the frozen snapshot for system prompt injection.
   *
   * Returns the state captured at loadFromDisk() time, NOT the live state.
   * Mid-session writes do not affect this. Keeps system prompt stable
   * across all turns, preserving the prefix cache.
   *
   * Returns null if the snapshot is empty (no entries at load time).
   */
  formatForSystemPrompt(): string | null {
    if (this.snapshot) return this.snapshot;
    // If no snapshot was captured, render current state
    const block = this._renderBlock();
    return block || null;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private _charCount(): number {
    if (this.entries.length === 0) return 0;
    return this.entries.join(ENTRY_DELIMITER).length;
  }

  private _successResponse(message: string): MemoryResult {
    const current = this._charCount();
    const pct = this.charLimit > 0
      ? Math.min(100, Math.floor((current / this.charLimit) * 100))
      : 0;

    return {
      success: true,
      entries: [...this.entries],
      usage: `${pct}% \u2014 ${current.toLocaleString()}/${this.charLimit.toLocaleString()} chars`,
      entryCount: this.entries.length,
      message,
    };
  }

  private _renderBlock(): string {
    if (this.entries.length === 0) return '';

    const content = this.entries.join(ENTRY_DELIMITER);
    const current = content.length;
    const pct = this.charLimit > 0
      ? Math.min(100, Math.floor((current / this.charLimit) * 100))
      : 0;

    const isUser = this.filePath.endsWith('USER.md');
    const isCompany = this.filePath.endsWith('COMPANY.md');
    const header = isCompany
      ? `COMPANY STATE (deliverables, assets, knowledge) [${pct}% \u2014 ${current.toLocaleString()}/${this.charLimit.toLocaleString()} chars]`
      : isUser
      ? `USER PROFILE (who the CEO is) [${pct}% \u2014 ${current.toLocaleString()}/${this.charLimit.toLocaleString()} chars]`
      : `MEMORY (your personal notes) [${pct}% \u2014 ${current.toLocaleString()}/${this.charLimit.toLocaleString()} chars]`;

    const separator = '\u2550'.repeat(46); // ══════
    return `${separator}\n${header}\n${separator}\n${content}`;
  }

  private _readFile(): string[] {
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      if (!raw.trim()) return [];
      const entries = raw.split(ENTRY_DELIMITER).map(e => e.trim()).filter(Boolean);
      return entries;
    } catch {
      return [];
    }
  }

  private _writeFile(): void {
    const content = this.entries.length > 0 ? this.entries.join(ENTRY_DELIMITER) : '';
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });

    // Atomic write: temp file + rename (same filesystem for atomic rename)
    const tmpPath = resolve(dir, `.mem_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
    try {
      writeFileSync(tmpPath, content, 'utf-8');
      const { renameSync } = require('fs');
      renameSync(tmpPath, this.filePath);
    } catch (e) {
      // Clean up temp file on failure
      try {
        const { unlinkSync } = require('fs');
        unlinkSync(tmpPath);
      } catch {
        // ignore cleanup failures
      }
      throw new Error(`Failed to write memory file ${this.filePath}: ${e}`);
    }

    // Notify standby manager if this is a Tamir memory file
    this._notifyStandbyIfTamirMemory();
  }

  /**
   * If this store manages a Tamir memory file, signal the standby manager
   * to refresh its pre-warmed sessions with updated soulMd.
   * Uses dynamic import() to avoid circular dependency.
   */
  private _notifyStandbyIfTamirMemory(): void {
    const tamirPaths = [TAMIR_MEMORY_PATH, TAMIR_USER_PATH, TAMIR_COMPANY_PATH];
    if (tamirPaths.includes(this.filePath)) {
      import('./tamir-standby').then(({ tamirStandby }) => {
        tamirStandby.markMemoryDirty();
      }).catch(() => {
        // Ignore -- standby may not be initialized yet
      });
    }
  }

  private _reloadFromDisk(): void {
    const fresh = this._readFile();
    // Deduplicate
    this.entries = [...new Map(fresh.map(e => [e, e])).values()];
  }

  private async _withLock<T>(fn: () => Promise<void> | void): Promise<void> {
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });

    // Ensure file exists for proper-lockfile
    try {
      readFileSync(this.filePath);
    } catch {
      writeFileSync(this.filePath, '', 'utf-8');
    }

    const release = await lockfile.lock(this.filePath, {
      retries: { retries: 3, minTimeout: 100, maxTimeout: 1000 },
      stale: 10000,
    });

    try {
      await fn();
    } finally {
      await release();
    }
  }
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

class MemoryLimitError extends Error {
  constructor(
    message: string,
    public currentEntries: string[],
    public usage: string,
  ) {
    super(message);
    this.name = 'MemoryLimitError';
  }
}
