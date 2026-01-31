#!/bin/bash
# post-create.sh - One-time setup after container creation
set -e

echo "=========================================="
echo "Sourcebot Dev Container: Post-Create Setup"
echo "=========================================="

cd /workspaces/sourcebot

# 1. Initialize git submodules (in case initializeCommand didn't run)
echo ""
echo "[1/2] Initializing git submodules..."
git submodule update --init --recursive

# 2. Build Zoekt and install dependencies (uses Makefile)
echo ""
echo "[2/2] Building Zoekt and installing dependencies..."
make

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
