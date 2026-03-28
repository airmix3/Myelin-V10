---
name: skill-tool-manager
description: "Manage installed skills and tools across departments — refresh (re-install/update to latest) or remove (uninstall and clean up). Use when the gallery UI triggers a refresh or remove action on a department's installed skill or tool."
status: active
scope: global
version: "1.0"
---

# Skill & Tool Manager

## Goal

You manage installed skills and tools across departments. You handle refresh (re-install/update to latest version) and removal (uninstall and clean up).

## When to Trigger

You receive a management prompt from the system (via the department gallery API). Never self-trigger.

## Context You Receive

Every management prompt includes:

- **Department** -- The target department (e.g., `tech`, `marketing`, `operations`)
- **Item type** -- `skill` or `tool`
- **Item name/ID** -- The skill name or tool package name
- **Action** -- `refresh` or `remove`
- **File path or directory** -- Where the item is installed

## Refresh Procedure

### For Skills
1. `cd` to the skill's parent directory
2. Run `npx skills add <owner/repo> --skill '<Display Name>' --yes` (overwrites existing)
3. Verify the SKILL.md file was updated

### For Tools
1. `cd` to the department tools directory
2. Run `npx @smithery/cli mcp add <package_name> --client claude-code` (overwrites existing)
3. Verify the package was updated in package.json or node_modules

## Remove Procedure

### For Tools
1. Check if any MCP server process is running for this tool (`ps aux | grep <tool_name>`)
2. Kill any running processes if found
3. `rm -rf` the tool directory in `data/departments/{dept}/tools/{tool_name}`
4. Remove from package.json dependencies if present

### For Skills
1. `rm -rf` the skill directory in `data/departments/{dept}/skills/{skill_name}`
2. The API handles removing the skill record from the database

## Failure Handling

If any operation fails:
1. Log the exact error message from stdout/stderr
2. Do NOT retry automatically -- report the failure with full error context
3. The calling system handles retry decisions
4. Include the exit code, any error output, and what was attempted
