<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/images/logo_dark.png">
    <img height="100" src=".github/images/logo_light.png" alt="Sourcebot">
  </picture>
</p>

<h3 align="center">Code understanding for humans and agents</h3>

<p align="center">
  <a href="https://www.sourcebot.dev">Website</a> ·
  <a href="https://docs.sourcebot.dev">Docs</a> ·
  <a href="https://app.sourcebot.dev">Public demo</a> ·
  <a href="https://www.sourcebot.dev/changelog">Changelog</a>
</p>

Sourcebot is a self-hosted code context layer for humans and AI agents. Index your repos in one place so you and your agents can search and navigate them. No need to clone each one locally.

## Get started

Run the setup wizard:

```sh
npx setup-sourcebot
```

You'll need Node.js (24 LTS recommended), Docker, and Docker Compose.

The wizard creates your config and Docker Compose files, then offers to start Sourcebot. It also lets you configure a language model provider for [Ask Sourcebot](https://docs.sourcebot.dev/docs/features/ask/ask-sourcebot). Once Sourcebot is running, open [localhost:3000](http://localhost:3000) to finish onboarding.

For manual setup, use [Docker Compose](#docker-compose) or the [Helm chart](#kubernetes).

## Connect your agent

Your agent can use Sourcebot to search repos you haven't checked out locally. For example, it can find callers of an API in other services or read the implementation of a shared library.

![Repositories on GitHub, GitLab, Bitbucket, and Azure DevOps connected through Sourcebot to agents via API/MCP and humans via the web app](.github/images/code-context.svg)

The MCP server exposes code search, file reading, and symbol definitions and references for the repos you've indexed. Open **Settings → MCP** in Sourcebot to connect Claude Code, Codex, Cursor, or another MCP client. The [MCP docs](https://docs.sourcebot.dev/docs/features/mcp-server) cover setup and authentication for each client. There's also a [walkthrough on our website](https://www.sourcebot.dev/code-context).

Connect repos from GitHub, GitLab, Bitbucket, Azure DevOps, or local Git directories using the [connection guides](https://docs.sourcebot.dev/docs/connections/indexing-your-code). [Permission syncing](https://docs.sourcebot.dev/docs/features/permission-syncing) controls access based on your code host's repository permissions.

## Code Search and Ask Sourcebot

[Code Search](https://docs.sourcebot.dev/docs/features/search/code-search) lets you search across repos and branches in the web app. It supports regex, repo and language filters, and boolean queries.

[Ask Sourcebot](https://docs.sourcebot.dev/docs/features/ask/ask-sourcebot) answers questions about your codebase with inline citations you can open alongside the answer. It uses the same search and navigation tools as the MCP server, with a [language model provider you configure](https://docs.sourcebot.dev/docs/configuration/language-model-providers).

Try both in the [public demo](https://app.sourcebot.dev). See [pricing](https://www.sourcebot.dev/pricing) for plan details.

## Deployment

### Docker Compose

The Docker image is `docker.sourcebot.dev/sourcebot-dev/sourcebot:latest`. The Compose file starts Sourcebot, PostgreSQL, and Redis.

1. In a new directory, download the Compose file:

   ```sh
   curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/docker-compose.yml
   ```

2. Create `config.json` in the same directory. This example indexes Sourcebot's public repository:

   ```json
   {
     "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v3/index.json",
     "connections": {
       "github": {
         "type": "github",
         "repos": ["sourcebot-dev/sourcebot"]
       }
     }
   }
   ```

   The [config file reference](https://docs.sourcebot.dev/docs/configuration/config-file) covers repository selection, credentials, and language model providers.

3. Replace the default secrets and credentials marked `CHANGEME` in `docker-compose.yml` before starting. Keep the PostgreSQL password and `DATABASE_URL` in sync. See the [Docker Compose guide](https://docs.sourcebot.dev/docs/deployment/docker-compose) and [environment variable reference](https://docs.sourcebot.dev/docs/configuration/environment-variables).

4. Start Sourcebot:

   ```sh
   docker compose up -d
   ```

   Open [localhost:3000](http://localhost:3000) once the app is ready to finish onboarding.

### Kubernetes

Deploy with the [Sourcebot Helm chart](https://github.com/sourcebot-dev/sourcebot-helm-chart). Follow the chart's installation instructions and use the [sizing guide](https://docs.sourcebot.dev/docs/deployment/sizing-guide) to choose CPU and memory allocations.

## Feedback

[Report a bug or request a feature](https://github.com/sourcebot-dev/sourcebot/issues/new/choose).
