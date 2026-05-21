# setup-sourcebot

Interactive CLI wizard for setting up a self-hosted [Sourcebot](https://sourcebot.dev) instance.

## Usage

Run from an empty directory:

```bash
npx setup-sourcebot
```

The wizard walks you through:

- **Code hosts** — GitHub, GitLab, Bitbucket (Cloud or Data Center), Azure DevOps (Cloud or Server), Gitea, Gerrit, a local folder of cloned repos, or any other git URL.
- **AI providers** (optional) — Anthropic, OpenAI, Google Gemini, Google Vertex, DeepSeek, Mistral, xAI, OpenRouter, OpenAI-compatible endpoints, Amazon Bedrock, or Azure OpenAI. Powers [Ask](https://docs.sourcebot.dev/docs/features/ask/overview).

## Requirements

- Node.js 18+
- Docker and Docker Compose

## Docs

Full deployment guide: [docs.sourcebot.dev/docs/deployment/docker-compose](https://docs.sourcebot.dev/docs/deployment/docker-compose)
