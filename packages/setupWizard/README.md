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

- Node.js 20.20+ (20.x), 22.22+ (22.x), or 23.5+ (including 24+). Node 24 LTS is recommended; Node 20 is supported for compatibility but is end-of-life.
- Docker and Docker Compose

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
PR and release verification run on Node 24 only; that is not the end-user minimum.
The optional `yarn workspace setup-sourcebot test:node-compatibility` command remains
available for targeted compatibility investigations, but is not part of CI or release verification.
The runtime suite uses `docker.sourcebot.dev/sourcebot-dev/sourcebot:latest`
(override only the test image with `SETUP_TEST_SOURCEBOT_IMAGE`).

## Docs

Full deployment guide: [docs.sourcebot.dev/docs/deployment/docker-compose](https://docs.sourcebot.dev/docs/deployment/docker-compose)
