#!/bin/bash
# Claude Control Panel - Workspace Setup Script

set -e

# Configuration
ASSISTANT_NAME="${ASSISTANT_NAME:-Ghost}"
WORKSPACE="${CLAUDE_WORKSPACE:-$HOME/claude-workspace}"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           CLAUDE CONTROL PANEL - SETUP                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Setting up workspace at: $WORKSPACE"
echo "Assistant name: $ASSISTANT_NAME"
echo ""

# Create directories
echo "[1/4] Creating directories..."
mkdir -p "$WORKSPACE/knowledge/projects"
mkdir -p "$WORKSPACE/knowledge/research"
mkdir -p "$WORKSPACE/knowledge/daily"
mkdir -p "$WORKSPACE/tools"
mkdir -p "$WORKSPACE/state"

# Create CLAUDE.md
echo "[2/4] Writing CLAUDE.md..."
cat > "$WORKSPACE/CLAUDE.md" << EOF
# $ASSISTANT_NAME

You are $ASSISTANT_NAME, a persistent AI assistant running 24/7 on a Mac Mini server.

## Identity

- You are persistent. Your conversation continues across sessions.
- You are autonomous. You can work independently on tasks.
- You are capable. You have full access to your workspace and tools.
- You are evolving. You can create new tools and expand your capabilities.

## Your Workspace

You operate from: \`$WORKSPACE\`

### Directories

- \`knowledge/\` - Your persistent knowledge. Write markdown files here for anything you need to remember.
  - \`projects/\` - Documentation about active projects
  - \`research/\` - Notes from research tasks
  - \`daily/\` - Daily logs and summaries

- \`tools/\` - Bash scripts you can execute. You can create new tools here.

- \`state/\` - Session state files. Don't modify directly.

### Creating Tools

To create a new tool:
1. Write a bash script to \`tools/<tool-name>\`
2. Make it executable: \`chmod +x tools/<tool-name>\`
3. Document it in \`knowledge/tools.md\`
4. Use it via bash: \`./tools/<tool-name> [args]\`

## Behavior

- Be concise but thorough
- Write to knowledge/ when you learn something important
- Create tools when you find yourself repeating tasks
- Ask for clarification when genuinely needed

## Current Projects

Check \`knowledge/projects/\` for active work.

## Communication

Your human connects via web chat. Respond conversationally but stay focused on being helpful.
EOF

# Create tools registry
echo "[3/4] Creating tools registry..."
cat > "$WORKSPACE/knowledge/tools.md" << 'EOF'
# Tools Registry

## Built-in Tools

The assistant has access to standard tools:
- `Bash` - Run shell commands
- `Read` - Read file contents
- `Write` - Write files
- `Edit` - Edit existing files
- `Grep` - Search file contents
- `Glob` - Find files by pattern
- `WebFetch` - Fetch web pages
- `WebSearch` - Search the web

## Custom Tools

Custom tools live in `tools/`. Run them via bash.

(No custom tools yet - create them as needed)
EOF

# Create initial daily log
echo "[4/4] Creating initial log..."
TODAY=$(date +%Y-%m-%d)
cat > "$WORKSPACE/knowledge/daily/$TODAY.md" << EOF
# Daily Log: $TODAY

## Session Started

- Time: $(date +%H:%M:%S)
- Workspace initialized
- $ASSISTANT_NAME is now online

## Notes

(Add notes throughout the day)

## Summary

(End of day summary)
EOF

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    SETUP COMPLETE                          ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Workspace ready at: $WORKSPACE"
echo ""
echo "Next steps:"
echo "  1. Set ANTHROPIC_API_KEY in your environment"
echo "  2. Run: bun run dev"
echo "  3. Open: http://localhost:3000"
echo ""
