# Sourcebot Installation Status

## ✅ Completed Steps

### 1. Prerequisites Installed
- ✅ **Node.js v24.13.1** - Installed via Homebrew
- ✅ **Go 1.26.0** - Installed via Homebrew
- ✅ **Docker 29.2.0** - Installed via Homebrew (Docker Desktop)
- ✅ **universal-ctags 6.2.1** - Installed via Homebrew
- ✅ **corepack** - Installed globally via npm
- ✅ **yarn 4.7.0** - Installed globally via npm

### 2. Repository Setup
- ✅ Git submodules initialized (`vendor/zoekt`)
- ✅ Node.js dependencies installed (`yarn install`)
- ✅ Dependency packages built (`yarn build:deps`)

## ⚠️ Known Issues

### Zoekt Build Issue
The `zoekt` binaries failed to build due to a linker error with Go 1.26 on macOS Sonoma:
```
Undefined symbols for architecture x86_64:
  "_SecTrustCopyCertificateChain"
```

**This is a known issue** with Go 1.26 and older macOS SDKs. However, this doesn't prevent you from using Sourcebot if you use the Docker image which includes pre-built zoekt binaries.

## 🔧 Important Configuration Notes

### Node.js PATH
Node.js 24 is "keg-only" and not automatically added to your PATH. You need to add it manually:

**For current terminal session:**
```bash
export PATH="/usr/local/opt/node@24/bin:$PATH"
```

**To make it permanent, add to ~/.zshrc:**
```bash
echo 'export PATH="/usr/local/opt/node@24/bin:$PATH"' >> ~/.zshrc
```

Note: There was a permission issue with ~/.zshrc. You may need to fix permissions:
```bash
sudo chown williamzhang ~/.zshrc
chmod u+w ~/.zshrc
```

## 📋 Next Steps

### Option 1: Use Docker (Recommended)
Since the zoekt build failed, the easiest way to get started is using Docker:

1. **Start Docker Desktop**
   - Open Docker Desktop from Applications
   - Wait for it to fully start

2. **Run Sourcebot with Docker Compose**
   ```bash
   docker compose up
   ```

3. **Access Sourcebot**
   - Visit http://localhost:3000

### Option 2: Development Setup (Requires fixing zoekt build)
If you want to develop Sourcebot locally:

1. **Fix zoekt build issue** (requires updating Go or macOS SDK)

2. **Start development containers**
   ```bash
   docker compose -f docker-compose-dev.yml up -d
   ```

3. **Generate database schema**
   ```bash
   export PATH="/usr/local/opt/node@24/bin:$PATH"
   yarn dev:prisma:migrate:dev
   ```

4. **Create configuration files**
   - Copy `.env.development` to `.env.development.local`
   - Create `config.json` with your repository configuration
   
5. **Start Sourcebot**
   ```bash
   export PATH="/usr/local/opt/node@24/bin:$PATH"
   yarn dev
   ```

## 📚 Additional Resources

- [Sourcebot Documentation](https://docs.sourcebot.dev/)
- [Configuration Guide](https://docs.sourcebot.dev/docs/configuration/config-file)
- [Deployment Guide](https://docs.sourcebot.dev/docs/deployment/docker-compose)
- [Contributing Guide](CONTRIBUTING.md)

## 🐛 Troubleshooting

### If you get "command not found: node"
```bash
export PATH="/usr/local/opt/node@24/bin:$PATH"
```

### If you get "command not found: yarn"
```bash
export PATH="/usr/local/opt/node@24/bin:$PATH"
npm install --global yarn --force
```

### If Docker commands fail
- Make sure Docker Desktop is running
- Check Docker status: `docker ps`

### If zoekt build fails (current issue)
- Use Docker instead of building from source
- OR wait for a fix to Go 1.26 / macOS SDK compatibility
- OR downgrade to Go 1.25 (not recommended)
