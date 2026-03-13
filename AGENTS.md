# Agents

## Cursor Cloud specific instructions

### Overview

Sourcebot is a self-hosted code intelligence platform (code search, navigation, AI Q&A). It's a Yarn 4 monorepo with packages under `packages/` and a vendored Go-based search engine (Zoekt) under `vendor/zoekt`.

### Prerequisites

- **Node.js 24+** (required by the project)
- **Go** (for building Zoekt binaries from `vendor/zoekt`)
- **Docker** (for PostgreSQL 16 and Redis 7 via `docker-compose-dev.yml`)
- **universal-ctags** (used by Zoekt for symbol indexing; pre-installed as `ctags`)

### Services and Ports

| Service | Port | Notes |
|---------|------|-------|
| Web (Next.js) | 3000 | Redirects to `/onboard` on first run |
| Backend worker | 3060 | Express + BullMQ job processor |
| Zoekt WebServer | 6070 | Code search engine (Go binary) |
| PostgreSQL | 5432 | Via `docker-compose-dev.yml` |
| Redis | 6379 | Via `docker-compose-dev.yml` |

### Key Commands

Standard dev commands are documented in `CONTRIBUTING.md` and `package.json`. Key ones:

- **Start all services:** `yarn dev` (runs zoekt, backend, web, mcp watcher, schemas watcher concurrently)
- **Lint:** `yarn workspace @sourcebot/web lint`
- **Test:** `yarn test` (runs all workspace tests)
- **Build deps only:** `yarn build:deps` (builds shared packages: schemas, db, shared, query-language)
- **DB migrations:** `yarn dev:prisma:migrate:dev`

### Non-obvious Caveats

- **Docker must be running** before `yarn dev`. Start it with `docker compose -f docker-compose-dev.yml up -d`. The backend will fail to connect to Redis/PostgreSQL otherwise.
- **Zoekt binaries** must be built before `yarn dev`. They live in `./bin/` and are built with `go build -C vendor/zoekt -o $(pwd)/bin ./cmd/...`. The `make zoekt` target does this.
- **Git submodules** must be initialized (`git submodule update --init --recursive`) before building Zoekt.
- **ctags compatibility:** The installed `ctags` may not support `--_interactive=default` (universal-ctags feature). Zoekt logs a warning but continues to index without symbol data. This does not block functionality.
- **First run onboarding:** On a fresh database, the web app redirects to `/onboard` where you create an owner account. Credentials login is enabled by default (`AUTH_CREDENTIALS_LOGIN_ENABLED` defaults to `true`).
- **Config file:** Create a `config.json` at the repo root (referenced by `CONFIG_PATH` in `.env.development`) to configure which repos to index. A minimal example is in `CONTRIBUTING.md`.
- **Environment variables:** `.env.development` has sensible defaults for local dev. Create `.env.development.local` for overrides (it's gitignored).
- The backend worker does not expose a health-check endpoint. Verify it's running by checking its logs or that BullMQ jobs are processing.

### Pull Request Workflow

- **CHANGELOG entry required:** Every PR must include a follow-up commit adding an entry to `CHANGELOG.md` under `[Unreleased]`. The entry must be a single sentence describing the change, followed by a link to the PR in the format `[#<id>](https://github.com/sourcebot-dev/sourcebot/pull/<id>)`. Place new entries at the bottom of the appropriate section (`Added`, `Changed`, `Fixed`, etc.). See `CLAUDE.md` and existing entries in `CHANGELOG.md` for the exact conventions.
