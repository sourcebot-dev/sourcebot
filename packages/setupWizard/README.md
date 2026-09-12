# setup-sourcebot

Interactive CLI wizard for setting up a self-hosted [Sourcebot](https://sourcebot.dev) instance.

## Usage

Run from an empty directory:

```bash
npx setup-sourcebot
```

The wizard walks you through:

- **Code hosts** — GitHub, GitLab, Bitbucket (Cloud or Data Center), Azure DevOps (Cloud or Server), Gitea, Gerrit, a local folder of cloned repos, or any other git URL.
- **AI providers** (optional) — Anthropic, OpenAI, Google Gemini, Google Vertex, DeepSeek, Mistral, xAI, OpenRouter, OpenAI-compatible endpoints, Amazon Bedrock, or Azure OpenAI. Powers [Ask](https://docs.sourcebot.dev/docs/features/ask/ask-sourcebot).

## Requirements

- Node.js 24+
- Docker and Docker Compose

## Setup analytics

The wizard sends high-level setup progress to Sourcebot's PostHog project: selected
code-host/provider types, counts, coarse system properties, and setup outcomes.
It does not send access tokens, repository/model names, email addresses, URLs,
hostnames, local paths, or raw errors. GeoIP enrichment is disabled.

Each invocation creates a random UUID in memory. New deployments receive that
same UUID as `SOURCEBOT_INSTALL_ID` in the existing `.env` file; a valid existing
ID is preserved. No telemetry state, identifier file, or disk queue is created.
Analytics failures do not prevent setup. The package's existing Reo installation
tracking remains separate; its `PACKAGE_TRACKER_ANALYTICS` setting and the
deployment's `SOURCEBOT_TELEMETRY_DISABLED` setting do not control wizard analytics.

Ctrl+C exits with status 130. Once foreground Docker has spawned, setup is recorded
as completed; interrupting it cleans up the CLI without changing that setup outcome.
Completion means configuration handoff, not that Sourcebot is healthy or ready.

## Development tests

From the repository root, under Node 24:

```bash
yarn workspace @sourcebot/schemas build
yarn workspace setup-sourcebot build
yarn workspace setup-sourcebot test
yarn workspace setup-sourcebot test:e2e
```

The E2E tests compile and pack the package, install it outside the repository,
drive its published binary in a PTY, inspect real SDK requests through a local TLS
collector, and clean up temporary installations. OpenSSL and Docker are required.
The runtime suite uses `docker.sourcebot.dev/sourcebot-dev/sourcebot:latest`
(override only the test image with `SETUP_TEST_SOURCEBOT_IMAGE`).

## Docs

Full deployment guide: [docs.sourcebot.dev/docs/deployment/docker-compose](https://docs.sourcebot.dev/docs/deployment/docker-compose)
