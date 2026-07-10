---
name: Codebase Guide
command: codebase-guide
description: Orientation for answering questions about the Sourcebot codebase. Covers the package map and entry points (indexing, search, Ask, auth), team terminology (connections vs connectors, lighthouse, core vs ee), and gotchas where a cold read of the code misleads. Load this before answering any question about how Sourcebot works or where something lives.
---

Background knowledge for answering questions about the Sourcebot codebase. Use the map to start from the right entry points, the glossary to use terms the way the team does, and the traps to avoid confidently wrong answers.

## The map

Sourcebot is a Yarn 4 monorepo. Application code lives under `packages/`, and the search engine (zoekt, a Go trigram-based code search engine) is vendored under `vendor/zoekt` with binaries built into `bin/`.

| Package | What it is |
|---|---|
| `packages/web` | The Next.js app: all UI, API routes, auth, and the Ask agent. Core features in `src/features/`, enterprise features in `src/ee/features/`. |
| `packages/backend` | The worker (also called "the backend"): an Express + BullMQ job processor that syncs connections, clones repos, and drives zoekt indexing. |
| `packages/db` | Prisma schema, migrations, and client. |
| `packages/schemas` | Generated types/validators for the declarative config file (source JSON schemas live in `schemas/` at the repo root). |
| `packages/queryLanguage` | Parser for the search query language. |
| `packages/shared` | Cross-package utilities: entitlements, logger, env handling. |
| `packages/setupWizard` | The `setup-sourcebot` CLI installer published to npm. |

Local services and ports: web on 3000, backend worker on 3060, zoekt webserver on 6070, Postgres 5432 and Redis 6379 via `docker-compose-dev.yml`.

Entry points for the major flows:

- **Indexing pipeline** (all in `packages/backend/src`): `connectionManager.ts` syncs connections against code-host APIs (per-host logic in `github.ts`, `gitlab.ts`, `bitbucket.ts`, `gitea.ts`, `gerrit.ts`, `azuredevops.ts`), `repoCompileUtils.ts` compiles connection results into Repo rows, and `repoIndexManager.ts` + `zoekt.ts` clone/fetch and index them into zoekt shards. The zoekt webserver serves the shards.
- **Search path**: the web app queries zoekt over gRPC from `packages/web/src/features/search/zoektSearcher.ts` (address from `ZOEKT_WEBSERVER_URL`).
- **Ask Sourcebot**: the agent loop is `packages/web/src/ee/features/chat/agent.ts`. MCP connectors are under `ee/features/chat/mcp/`. Note the chat code is split: `src/features/chat/` holds shared types and UI, `src/ee/features/chat/` holds the agent itself.
- **Auth**: NextAuth configuration in `packages/web/src/features/auth`. Server actions and API routes are gated by `withAuth`/`withOptionalAuth` (`src/middleware/`), which provide a user-scoped Prisma client that enforces repository visibility. Answers about "who can see what" should route through that scoping, not raw Prisma.
- **Permission syncing** (EE, `packages/backend/src/ee/`): `repoPermissionSyncer.ts` and `accountPermissionSyncer.ts` mirror code-host permissions into Sourcebot.

## Glossary

- **Connection** — a code-host sync configuration (GitHub, GitLab, Bitbucket, ...) declared in the config file. Connections are synced by the backend and produce repos. Completely unrelated to connectors.
- **Connector** — an MCP integration that plugs an external tool (Jira, Slack, Linear, ...) into Ask Sourcebot. Lives under `packages/web/src/ee/features/chat/mcp/`. One letter away from "connection", entirely different concept.
- **Lighthouse** — Sourcebot's internal licensing and telemetry service (a separate deployment; client code under `packages/web/src/ee/features/lighthouse/`). It is NOT Google Lighthouse, and questions about license validation route here.
- **Zoekt** — the vendored code search engine. "Shards" are its on-disk index files.
- **Core vs EE** — a licensing boundary, not an architectural one. Any folder named `ee/` is under the Sourcebot Enterprise License; everything else is FSL. EE features are gated at runtime by entitlements (`packages/shared/src/entitlements.ts`).
- **Search contexts** — named groupings of repos used to scope searches (EE).
- **Skills** — reusable instruction sets for Ask Sourcebot (like this one), invoked via slash command or loaded automatically by the agent.
- **Service ping** — the periodic telemetry heartbeat an instance sends, including deployment stats.

## Traps: where a cold read of the code misleads

- **`packages/web/src/proxy.ts` IS the middleware.** Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`. There is no `middleware.ts`, and `proxy.ts` is not dead code — request-level logic lives there.
- **`AUTH_EE_*` environment variables are gone.** Since v5.0.2, identity providers (GitHub, GitLab, Google, Okta, Keycloak, Entra) are configured only via the config file. Old issues, docs, and code comments referencing `AUTH_EE_*` are obsolete.
- **v5 removed the embedded Postgres and Redis** from the Docker image. Deployments must provide external `DATABASE_URL` and `REDIS_URL`. Any pre-v5 guidance about the all-in-one container is outdated.
- **Secrets are no longer auto-generated.** Since v5, `AUTH_SECRET` and `SOURCEBOT_ENCRYPTION_KEY` must be set explicitly; Sourcebot no longer writes them to the data volume.
- **Ask Sourcebot and MCP are EE since v5.** They were relicensed from core; don't describe them as community features.
- **Membership states are derived, not stored.** Active/pending/suspended come from `suspendedAt`/`lastActiveAt` on `UserToOrg` — use the predicates in `packages/web/src/features/membership/utils.ts` rather than reasoning about a status column that doesn't exist.
- **Local symbol search requires universal-ctags exactly v6.1.0.** Newer versions are incompatible with zoekt; when local symbol search silently returns nothing, the ctags version (and `CTAGS_COMMAND`) is the first thing to check.

## Answering style

When answering questions about this codebase, cite concrete file paths (preferably the entry points above) so answers are verifiable, and explicitly flag when a question touches one of the traps — that context is usually the part the asker is missing.
