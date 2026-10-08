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

Sourcebot is a self-hosted code context layer for humans and AI agents. Index all your repos in one place so you and your agents can search and navigate them.

## Get started

Run the setup wizard:

```sh
npx setup-sourcebot
```

You'll need Node.js (24 LTS recommended), Docker, and Docker Compose.

This wizard walks you through indexing your repos, optionally configuring a language model provider (for [Ask Sourcebot](https://docs.sourcebot.dev/docs/features/ask/ask-sourcebot)), and then creates the config files for you and starts up Sourcebot.

For manual setup, use [Docker Compose](https://docs.sourcebot.dev/docs/deployment/docker-compose) or the [Helm chart](https://github.com/sourcebot-dev/sourcebot-helm-chart).

## Connect your agent

Your agent can use [Sourcebot MCP](https://docs.sourcebot.dev/docs/features/mcp-server) to search repos you haven't checked out locally. For example, it can find callers of an API in other services or read the implementation for dependencies that you don't have checked out locally.

![Repositories on GitHub, GitLab, Bitbucket, and Azure DevOps connected through Sourcebot to agents via API/MCP and humans via the web app](.github/images/code-context.svg)

The MCP server exposes code search, file reading, and symbol definitions and references for the repos you've indexed. Open **Settings → MCP** in Sourcebot to connect Claude Code, Codex, Cursor, or another MCP client. The [MCP docs](https://docs.sourcebot.dev/docs/features/mcp-server) cover setup and authentication for each client.

Connect repos from GitHub, GitLab, Bitbucket, Azure DevOps, or local Git directories using the [connection guides](https://docs.sourcebot.dev/docs/connections/indexing-your-code). [Permission syncing](https://docs.sourcebot.dev/docs/features/permission-syncing) controls access based on your code host's repository permissions.

## Code Search and Ask Sourcebot

[Code Search](https://docs.sourcebot.dev/docs/features/search/code-search) lets you search across repos and branches in the web app. It supports regex, repo and language filters, and boolean queries.

[Ask Sourcebot](https://docs.sourcebot.dev/docs/features/ask/ask-sourcebot) answers questions about your codebase with inline citations you can open alongside the answer. It uses the same search and navigation tools as the MCP server, with a [language model provider you configure](https://docs.sourcebot.dev/docs/configuration/language-model-providers) (Bring Your Own Key).

Try both in the [public demo](https://app.sourcebot.dev). See [pricing](https://www.sourcebot.dev/pricing) for plan details.


## Feedback

[Report a bug or request a feature](https://github.com/sourcebot-dev/sourcebot/issues/new/choose).
