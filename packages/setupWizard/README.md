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
yarn workspace setup-sourcebot test:node-compatibility
```

The E2E tests compile and pack the package, install it outside the repository,
drive its published binary in a PTY, inspect real SDK requests through a local TLS
collector, and clean up temporary installations. OpenSSL and Docker are required.
PR verification runs nine parallel OS/Node jobs (Linux, macOS, Windows × Node
20.20.0, 22.22.0, 24). Each job builds and packs on Node 24 before selecting its
test runtime. Linux runs the full CLI regression suite on each version; macOS and
Windows run unit/integration and platform smoke tests. Docker identity, baseline,
and package-manager checks run only in the Node 24 Linux job.
Release verification also runs `test:node-compatibility` against the exact publish
tarball; that command checks the older runtimes sequentially, including early
rejection on Node 18, 20.19, and 22.21. Node 24 is not the end-user minimum.
The runtime suite uses `docker.sourcebot.dev/sourcebot-dev/sourcebot:latest`
(override only the test image with `SETUP_TEST_SOURCEBOT_IMAGE`).

## Docs

Full deployment guide: [docs.sourcebot.dev/docs/deployment/docker-compose](https://docs.sourcebot.dev/docs/deployment/docker-compose)
