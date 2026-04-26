#!/usr/bin/env bash
set -euo pipefail

# Myelin v10 -- Setup Script
# Works on Linux, macOS, and WSL2.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!!]${NC} $1"; }
fail()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

echo ""
echo "  Myelin v10 -- The Cortex"
echo "  Setup"
echo "  ─────────────────────────"
echo ""

# ── 1. Check prerequisites ──────────────────────────

echo "Checking prerequisites..."

# Node.js
if ! command -v node &>/dev/null; then
  fail "Node.js not found. Install Node.js 20+ from https://nodejs.org"
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  fail "Node.js $NODE_VERSION found, but 20+ required."
fi
info "Node.js $(node -v)"

# pnpm
if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found. Installing via corepack..."
  corepack enable
  corepack prepare pnpm@latest --activate
  if ! command -v pnpm &>/dev/null; then
    fail "pnpm installation failed. Install manually: npm install -g pnpm"
  fi
fi
info "pnpm $(pnpm -v)"

# Claude Code
CLAUDE_BIN=""
if command -v claude &>/dev/null; then
  CLAUDE_BIN=$(which claude)
  info "Claude Code found at $CLAUDE_BIN"
elif [ -f "$HOME/.npm-global/bin/claude" ]; then
  CLAUDE_BIN="$HOME/.npm-global/bin/claude"
  info "Claude Code found at $CLAUDE_BIN"
else
  warn "Claude Code not found on PATH."
  warn "Install with: npm install -g @anthropic-ai/claude-code"
  warn "Then re-run this script, or set CLAUDE_CODE_PATH in .env manually."
fi

echo ""

# ── 2. Install dependencies ─────────────────────────

echo "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
info "Dependencies installed"

echo ""

# ── 3. Configure .env ───────────────────────────────

if [ ! -f .env ]; then
  cp .env.example .env
  info "Created .env from .env.example"

  # Auto-fill CLAUDE_CODE_PATH if we found it
  if [ -n "$CLAUDE_BIN" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|# CLAUDE_CODE_PATH=.*|CLAUDE_CODE_PATH=$CLAUDE_BIN|" .env
    else
      sed -i "s|# CLAUDE_CODE_PATH=.*|CLAUDE_CODE_PATH=$CLAUDE_BIN|" .env
    fi
    info "Set CLAUDE_CODE_PATH=$CLAUDE_BIN in .env"
  fi

  echo ""
  warn "Edit .env to add your LLM provider credentials before starting."
  warn "  Anthropic API: set ANTHROPIC_API_KEY"
  warn "  AWS Bedrock:   set CLAUDE_CODE_USE_BEDROCK=1 + AWS credentials"
  warn "  Claude OAuth:  run 'claude' to log in (no env vars needed)"
else
  info ".env already exists, skipping"
fi

echo ""

# ── 4. Initialize database ──────────────────────────

echo "Initializing database..."
npx prisma generate
npx prisma migrate deploy
info "Database initialized"

echo ""

# ── 5. Create runtime directories ───────────────────

mkdir -p data/vault
mkdir -p data/workspaces
mkdir -p data/agents
mkdir -p data/tmp
for dept in tech marketing operations cos global; do
  mkdir -p "data/departments/$dept/knowledge"
  mkdir -p "data/departments/$dept/skills"
  mkdir -p "data/departments/$dept/tools"
done
for dept in tech marketing operations; do
  mkdir -p "data/departments/$dept/planning-desk/chat"
done
info "Runtime directories created"

echo ""

# ── 6. Install Tamir plugins ──────────────────────────

echo "Installing Tamir plugins..."

SKILL_CREATOR_DIR="data/departments/cos/skills/skill-creator"
if [ -d "$SKILL_CREATOR_DIR/skills/skill-creator" ]; then
  info "skill-creator already installed"
else
  # Clone skill-creator from Anthropic's official plugin marketplace
  TMPDIR_SC=$(mktemp -d)
  if git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/anthropics/claude-plugins-official.git "$TMPDIR_SC" 2>/dev/null; then
    git -C "$TMPDIR_SC" sparse-checkout set plugins/skill-creator
    mkdir -p "$SKILL_CREATOR_DIR"
    cp -r "$TMPDIR_SC/plugins/skill-creator/"* "$SKILL_CREATOR_DIR/"
    cp -r "$TMPDIR_SC/plugins/skill-creator/.claude-plugin" "$SKILL_CREATOR_DIR/"
    rm -rf "$TMPDIR_SC"
    info "skill-creator installed to $SKILL_CREATOR_DIR"
  else
    rm -rf "$TMPDIR_SC"
    warn "Could not clone skill-creator from GitHub."
    warn "Tamir will work without it. Install manually later."
  fi
fi

echo ""

# ── Done ─────────────────────────────────────────────

echo "  ─────────────────────────"
echo ""
info "Setup complete."
echo ""
echo "  Start the server:"
echo "    pnpm dev"
echo ""
echo "  The Cortex will be at http://localhost:3000"
echo ""
if [ ! -n "${CLAUDE_BIN:-}" ]; then
  warn "Remember to install Claude Code and set CLAUDE_CODE_PATH in .env"
fi
