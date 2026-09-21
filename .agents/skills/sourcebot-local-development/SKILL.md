# Sourcebot Local Development for Cursor Cloud Agents

## Overview

This skill documents the workflow for Cursor Cloud Agents working on Sourcebot. Cloud agents own the full E2E testing workflow, including visible UI testing, on the cloud VM.

## Environment

Sourcebot runs as a Yarn 4 monorepo with:

- **Web (Next.js)**: Port 3000 - Main application UI
- **Backend worker**: Port 3060 - Express + BullMQ job processor
- **Zoekt WebServer**: Port 6070 - Code search engine
- **PostgreSQL**: Port 5432 - Database
- **Redis**: Port 6379 - Job queue

## Key Commands

```bash
# Start all services (after install)
yarn dev

# Run database migrations
yarn dev:prisma:migrate:dev

# Build shared packages
yarn build:deps

# Run linting
yarn workspace @sourcebot/web lint

# Run tests
yarn test
```

## Testing Workflow

### Cloud Agents Own E2E Testing

Cursor Cloud Agents are responsible for:

1. **Visible UI E2E testing** on the cloud VM using the computerUse subagent
2. **Automated tests** via `yarn test`
3. **Manual verification** of UI changes via screenshots/recordings

The coordinator (or Grok Bot) should **NOT re-run UI E2E tests** on a separate computer once the cloud agent has proven them working.

### First Run Onboarding

On a fresh database, the app redirects to `/onboard` where you:
1. Create an owner account (email/password)
2. Set up the organization
3. Configure repository connections

### Testing Checklist

- [ ] App boots successfully (`yarn dev`)
- [ ] HTTP 200 on `http://localhost:3000` (may redirect to `/onboard`)
- [ ] Onboarding flow completes (if fresh DB)
- [ ] Repositories page loads
- [ ] Code search works (after indexing completes)

## Merge Policy

**Important**: Sourcebot differs from Bain:

- **Never auto-merge PRs**
- Wait for Michael's **explicit approval** before merging any PR
- Never manual-deploy via Vercel; merge to `origin/main` only after approval for Git-connected deploy

## Runtime Secrets

The following secrets may be needed (configured in Cursor Dashboard > Cloud Agents > Secrets):

| Secret Name | Purpose | Required for Boot? |
|-------------|---------|-------------------|
| `ANTHROPIC_API_KEY` | AI Q&A features (Anthropic Claude) | No (optional AI features) |
| `OPENAI_API_KEY` | AI Q&A features (OpenAI) | No (optional AI features) |
| `FALLBACK_GITHUB_CLOUD_TOKEN` | GitHub API access for private repos | No (public repos work without) |
| `POSTHOG_PAPIK` | Telemetry (if `SOURCEBOT_TELEMETRY_DISABLED=false`) | No |

Most environment variables have sensible defaults in `.env.development`. Create `.env.development.local` for overrides.

## Config File

The `config.json` at repo root (referenced by `CONFIG_PATH`) configures which repos to index:

```json
{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v3/index.json",
    "connections": {
        "github-public": {
            "type": "github",
            "repos": ["sourcebot-dev/sourcebot"]
        }
    }
}
```

For AI features, add a `models` section with appropriate API keys.

## Troubleshooting

### Docker Issues

If Docker fails to start:
```bash
# Start Docker daemon manually
sudo dockerd > /tmp/dockerd.log 2>&1 &
sleep 3
sudo chmod 666 /var/run/docker.sock
```

### Database Connection Issues

Ensure PostgreSQL container is running:
```bash
docker compose -f docker-compose-dev.yml up -d
docker ps  # Should show sourcebot-postgres and sourcebot-redis
```

### Zoekt Binaries Missing

Rebuild from vendor:
```bash
git submodule update --init --recursive
mkdir -p bin
go build -C vendor/zoekt -o $(pwd)/bin ./cmd/...
```
