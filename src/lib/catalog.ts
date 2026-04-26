/**
 * Department Data Catalog — filesystem-based data catalog with provenance sidecars.
 * Each department has a sharedlib/ directory with auto-compiled DATA_CATALOG.md.
 * Pure filesystem + markdown — no database dependency.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync } from 'fs';
import { join, relative, basename, resolve, dirname, extname } from 'path';
import { createHash } from 'crypto';
import { dataPath } from '@/lib/paths';

const DEPARTMENTS = ['cos', 'tech', 'marketing', 'operations'] as const;
type Department = (typeof DEPARTMENTS)[number];

export interface MetaSidecar {
  filename: string;
  addedBy: string;
  addedAt: string;
  sourceTaskId: string | null;
  description: string;
  location: 'local' | 'gdrive';
  driveUrl?: string;
  driveFileId?: string;
  contentHash: string;
}

interface CatalogEntry {
  relativePath: string;
  contentHash: string;
  addedBy: string;
  addedAt: string;
  sourceTaskId: string | null;
  location: 'local' | 'gdrive';
  description: string;
  preview: string;
}

interface CompileResult {
  department: string;
  totalFiles: number;
  newFiles: number;
  updatedFiles: number;
}

function sharedLibDir(department: string): string {
  return dataPath('departments', department, 'sharedlib');
}

/**
 * Ensure sharedlib/ directories exist for all 4 departments.
 */
export function ensureSharedLibDirs(): void {
  for (const dept of DEPARTMENTS) {
    mkdirSync(sharedLibDir(dept), { recursive: true });
  }
}

/**
 * Compute SHA-256 hash of a string or buffer.
 */
function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get the .meta.json sidecar path for a given file.
 */
function sidecarPath(filePath: string): string {
  const dir = dirname(filePath);
  const name = basename(filePath);
  return join(dir, `${name}.meta.json`);
}

/**
 * Create a .meta.json sidecar for a file with provenance metadata.
 */
export function createSidecar(
  filePath: string,
  opts: {
    addedBy: string;
    sourceTaskId?: string;
    description: string;
    location?: 'local' | 'gdrive';
    driveUrl?: string;
    driveFileId?: string;
  },
): MetaSidecar {
  const location = opts.location || 'local';
  let contentHash = '';

  if (location === 'local' && existsSync(filePath)) {
    const content = readFileSync(filePath);
    contentHash = sha256(content);
  }

  const sidecar: MetaSidecar = {
    filename: basename(filePath),
    addedBy: opts.addedBy,
    addedAt: new Date().toISOString(),
    sourceTaskId: opts.sourceTaskId ?? null,
    description: opts.description,
    location,
    contentHash,
  };

  if (opts.driveUrl) sidecar.driveUrl = opts.driveUrl;
  if (opts.driveFileId) sidecar.driveFileId = opts.driveFileId;

  writeFileSync(sidecarPath(filePath), JSON.stringify(sidecar, null, 2), 'utf-8');
  return sidecar;
}

/**
 * Read the .meta.json sidecar for a file. Returns null if not found.
 */
export function readSidecar(filePath: string): MetaSidecar | null {
  const metaPath = sidecarPath(filePath);
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8')) as MetaSidecar;
  } catch {
    return null;
  }
}

/**
 * Recursively walk a directory and return all file paths.
 */
function walkDir(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Parse existing DATA_CATALOG.md to extract previously compiled entry hashes.
 * Returns a map of relativePath -> contentHash.
 */
function parseExistingCatalog(catalogPath: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(catalogPath)) return map;

  const content = readFileSync(catalogPath, 'utf-8');
  // Match sections like: ### path/to/file.ext ... <!-- hash:abc123 -->
  const sectionRegex = /### (.+)\n[\s\S]*?<!-- hash:([a-f0-9]+) -->/g;
  let match;
  while ((match = sectionRegex.exec(content)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

const DEPT_DISPLAY_NAMES: Record<string, string> = {
  cos: 'Chief of Staff',
  tech: 'Technology',
  marketing: 'Marketing',
  operations: 'Operations',
};

/**
 * Compile DATA_CATALOG.md for a department. Incremental — only processes new/changed files.
 */
export function compileCatalog(department: string): CompileResult {
  const libDir = sharedLibDir(department);
  mkdirSync(libDir, { recursive: true });

  const catalogPath = join(libDir, 'DATA_CATALOG.md');
  const existingHashes = parseExistingCatalog(catalogPath);

  // Find all files, excluding .meta.json and DATA_CATALOG.md
  const allFiles = walkDir(libDir).filter((f) => {
    const name = basename(f);
    return name !== 'DATA_CATALOG.md' && !name.endsWith('.meta.json');
  });

  let newCount = 0;
  let updatedCount = 0;
  const entries: CatalogEntry[] = [];

  for (const filePath of allFiles) {
    const relPath = relative(libDir, filePath);
    const meta = readSidecar(filePath);

    // Compute current hash
    let currentHash = '';
    if (existsSync(filePath)) {
      currentHash = sha256(readFileSync(filePath));
    }

    const previousHash = existingHashes.get(relPath);

    if (!previousHash) {
      newCount++;
    } else if (previousHash !== currentHash) {
      updatedCount++;
    }
    // If hash matches, we still include the entry but it wasn't re-processed

    // Build preview
    let preview = '';
    if (meta?.location === 'gdrive') {
      preview = 'Google Drive reference';
    } else if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        preview = content.slice(0, 200).replace(/\n/g, ' ').trim();
      } catch {
        preview = '(binary file)';
      }
    }

    entries.push({
      relativePath: relPath,
      contentHash: currentHash,
      addedBy: meta?.addedBy ?? 'unknown',
      addedAt: meta?.addedAt ?? 'unknown',
      sourceTaskId: meta?.sourceTaskId ?? null,
      location: meta?.location ?? 'local',
      description: meta?.description ?? '',
      preview,
    });
  }

  // Build catalog markdown
  const now = new Date().toISOString();
  const deptName = DEPT_DISPLAY_NAMES[department] || department;
  let md = `# Data Catalog — ${deptName}\n`;
  md += `_Auto-compiled: ${now}_\n`;
  md += `_Files: ${entries.length} | New this compile: ${newCount}_\n\n`;
  md += `## Files\n\n`;

  for (const entry of entries) {
    md += `### ${entry.relativePath}\n`;
    md += `- **Added by:** ${entry.addedBy} | **Date:** ${entry.addedAt}\n`;
    md += `- **Source task:** ${entry.sourceTaskId || 'manual'}\n`;
    md += `- **Location:** ${entry.location}\n`;
    md += `- **Description:** ${entry.description || '(none)'}\n`;
    md += `- **Preview:** ${entry.preview || '(empty)'}\n`;
    md += `<!-- hash:${entry.contentHash} -->\n\n---\n\n`;
  }

  writeFileSync(catalogPath, md, 'utf-8');

  return {
    department,
    totalFiles: entries.length,
    newFiles: newCount,
    updatedFiles: updatedCount,
  };
}

/**
 * Compile VAULT_CATALOG.md for the company vault (data/vault/).
 * Follows the same pattern as compileCatalog() but for the flat vault directory.
 */
export function compileVaultCatalog(): CompileResult {
  const vaultDir = dataPath('vault');
  mkdirSync(vaultDir, { recursive: true });

  const catalogPath = join(vaultDir, 'VAULT_CATALOG.md');
  const existingHashes = parseExistingCatalog(catalogPath);

  // Find all files, excluding VAULT_CATALOG.md, .meta.json sidecars, and .gitkeep
  const allFiles = readdirSync(vaultDir)
    .filter((name) => {
      return name !== 'VAULT_CATALOG.md' && !name.endsWith('.meta.json') && name !== '.gitkeep';
    })
    .map((name) => join(vaultDir, name))
    .filter((f) => statSync(f).isFile());

  let newCount = 0;
  let updatedCount = 0;
  const entries: CatalogEntry[] = [];

  for (const filePath of allFiles) {
    const name = basename(filePath);
    const meta = readSidecar(filePath);

    // Compute current hash
    let currentHash = '';
    if (existsSync(filePath)) {
      currentHash = sha256(readFileSync(filePath));
    }

    const previousHash = existingHashes.get(name);

    if (!previousHash) {
      newCount++;
    } else if (previousHash !== currentHash) {
      updatedCount++;
    }

    // Determine file type from extension
    const ext = extname(name).replace('.', '').toLowerCase();
    const typeLabel = ext || 'unknown';

    // Build preview (not used in vault catalog format, but kept for CatalogEntry compat)
    let preview = '';
    try {
      const content = readFileSync(filePath, 'utf-8');
      preview = content.slice(0, 200).replace(/\n/g, ' ').trim();
    } catch {
      preview = '(binary file)';
    }

    // Fall back to file stat for date if no sidecar
    let addedAt = meta?.addedAt ?? 'unknown';
    if (!meta) {
      try {
        addedAt = statSync(filePath).mtime.toISOString();
      } catch {
        // keep 'unknown'
      }
    }

    entries.push({
      relativePath: name,
      contentHash: currentHash,
      addedBy: meta?.addedBy ?? 'unknown',
      addedAt,
      sourceTaskId: meta?.sourceTaskId ?? null,
      location: meta?.location ?? 'local',
      description: meta?.description ?? '',
      preview,
    });
  }

  // Build vault catalog markdown
  const now = new Date().toISOString();
  let md = `# Vault Catalog\n`;
  md += `_Auto-compiled: ${now}_\n`;
  md += `_Documents: ${entries.length}_\n\n`;
  md += `## Documents\n\n`;

  for (const entry of entries) {
    md += `### ${entry.relativePath}\n`;
    md += `- **Description:** ${entry.description || '(no description)'}\n`;
    md += `- **Added by:** ${entry.addedBy}\n`;
    md += `- **Date:** ${entry.addedAt}\n`;
    md += `- **Type:** ${extname(entry.relativePath).replace('.', '').toLowerCase() || 'unknown'}\n`;
    md += `<!-- hash:${entry.contentHash} -->\n\n---\n\n`;
  }

  writeFileSync(catalogPath, md, 'utf-8');

  return {
    department: 'vault',
    totalFiles: entries.length,
    newFiles: newCount,
    updatedFiles: updatedCount,
  };
}

/**
 * Ingest a deliverable into a department's sharedlib with provenance sidecar.
 */
export function ingestDeliverable(opts: {
  department: string;
  sourceTaskId: string;
  agentId: string;
  deliverablePath: string;
  description: string;
}): string {
  const libDir = sharedLibDir(opts.department);
  mkdirSync(libDir, { recursive: true });

  const srcName = basename(opts.deliverablePath);
  let destName = srcName;

  // Handle filename conflicts by appending timestamp
  const destPath = join(libDir, destName);
  if (existsSync(destPath)) {
    const ext = extname(srcName);
    const nameNoExt = basename(srcName, ext);
    destName = `${nameNoExt}-${Date.now()}${ext}`;
  }

  const finalPath = join(libDir, destName);
  copyFileSync(opts.deliverablePath, finalPath);

  createSidecar(finalPath, {
    addedBy: opts.agentId,
    sourceTaskId: opts.sourceTaskId,
    description: opts.description,
  });

  return finalPath;
}
