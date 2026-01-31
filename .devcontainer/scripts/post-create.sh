#!/bin/bash
# post-create.sh - One-time setup after container creation
set -e

echo "=========================================="
echo "Sourcebot Dev Container: Post-Create Setup"
echo "=========================================="

cd /workspaces/sourcebot

# 1. Initialize git submodules (in case initializeCommand didn't run)
echo ""
echo "[1/4] Initializing git submodules..."
git submodule update --init --recursive

# 2. Build Zoekt and install dependencies (uses Makefile)
echo ""
echo "[2/4] Building Zoekt and installing dependencies..."
make

echo ""
echo "[3/4] Running database migrations..."
yarn dev:prisma:migrate:dev

echo ""
echo "[4/5] Creating default config.json..."
cat > config.json << 'EOF'
{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v3/index.json",
    "connections": {
        "github": {
            "type": "github",
            "repos": ["sourcebot-dev/sourcebot"]
        }
    }
}
EOF

echo ""
echo "[5/5] Configuring Claude Code to skip onboarding..."
# Create or update ~/.claude.json to skip onboarding
if [ -f ~/.claude.json ]; then
    # Update existing file
    node -e "const fs=require('fs');const cfg=JSON.parse(fs.readFileSync('$HOME/.claude.json','utf8'));cfg.hasCompletedOnboarding=true;fs.writeFileSync('$HOME/.claude.json',JSON.stringify(cfg,null,2));"
else
    # Create minimal config with onboarding skipped
    cat > ~/.claude.json << 'EOF'
{
  "hasCompletedOnboarding": true
}
EOF
fi

echo ""
echo "=========================================="
echo "Post-create setup complete!"
echo ""
echo "To start the development server, run:"
echo "  yarn dev"
echo ""
echo "Services will be available at:"
echo "  - Web App: http://localhost:3000"
echo "  - Zoekt:   http://localhost:6070"
echo "=========================================="
