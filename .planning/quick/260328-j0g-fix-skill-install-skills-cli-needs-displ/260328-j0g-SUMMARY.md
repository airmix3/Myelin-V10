---
plan: 260328-j0g
status: complete
started: 2026-03-28T06:00:00Z
completed: 2026-03-28T06:15:00Z
duration: 15min
---

## One-liner

Fixed skill install failure — skills CLI `--skill` flag matches SKILL.md frontmatter name not directory name

## Root Cause

The `install_skill` MCP tool ran `npx skills add rknall/claude-skills --skill 'svg-logo-designer'`. But the `skills` CLI `--skill` flag matches against the `name` field in SKILL.md frontmatter (e.g., `"SVG Logo Designer"`), NOT the directory name (e.g., `svg-logo-designer`).

Result: "No matching skills found for: svg-logo-designer" → install failed silently, agent fell back to hand-coding SVGs.

## Fix

Convert kebab-case directory name to Title Case before passing to `--skill` flag. Also added `--yes` flag for non-interactive execution.

Before: `npx skills add rknall/claude-skills --skill 'svg-logo-designer'`
After: `npx skills add rknall/claude-skills --skill 'SVG Logo Designer' --yes`

## Key Files

- `src/lib/mcp/tools/install.ts` — kebab-to-title conversion + --yes flag
