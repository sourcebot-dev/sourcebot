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

- Node.js 18+
- Docker and Docker Compose

## Local repositories with spaces in the path

When the wizard indexes a local folder of cloned repositories, it writes a Docker Compose bind mount for that folder. Paths that contain spaces (for example, `/Users/alex/Code/Client Projects`) need extra care because Docker Compose, shells, and JSON strings all parse quoting slightly differently.

Before running `npx setup-sourcebot`, prefer a local repository folder whose absolute path does not contain spaces, such as `/Users/alex/sourcebot-repos` or `/opt/sourcebot/repos`. This is the most reliable option across macOS, Linux, and Docker Desktop.

If you must use a folder with spaces, use this checklist before starting Sourcebot:

1. Confirm the host path is absolute, not relative: run `pwd` from the parent directory and copy the full path.
2. Confirm Docker can see the folder. On Docker Desktop, add the parent directory under **Settings → Resources → File sharing** if it is not already shared.
3. Keep the generated `docker-compose.yml` bind mount as a single YAML string. Do not split the host path on spaces or remove quotes added by the wizard.
4. If you edit the compose file manually, quote the full mount entry, for example `"/Users/alex/Code/Client Projects:/repos:ro"`.
5. Do not escape spaces inside the YAML string with backslashes unless you have verified the resulting compose config still contains the real path.
6. Validate the final mount with `docker compose config` from the setup directory. The rendered service should show one volume whose source is the full host path and whose target is the container path.
7. If `docker compose up` reports `invalid mount config`, `bind source path does not exist`, or creates a directory named only after the first word in the path, re-check quoting and the absolute source path.
8. If Sourcebot starts but no local repositories appear, exec into the container or temporarily run a shell with the same volume to confirm the repositories are visible under the mounted target.
9. Avoid moving or renaming the local repository folder after setup; update the compose volume and rerun `docker compose up -d` if the path changes.
10. For repeatable setups, create a symlink without spaces (for example, `/Users/alex/sourcebot-repos -> /Users/alex/Code/Client Projects`) and mount the symlink path.

A minimal bind mount for a path with spaces should render like this after `docker compose config`:

```yaml
services:
  sourcebot:
    volumes:
      - type: bind
        source: /Users/alex/Code/Client Projects
        target: /repos
        read_only: true
```

If the rendered `source:` is truncated, contains literal quote characters, or points to a path that does not exist on the host, fix the setup directory's `docker-compose.yml` before starting Sourcebot.

## Docs

Full deployment guide: [docs.sourcebot.dev/docs/deployment/docker-compose](https://docs.sourcebot.dev/docs/deployment/docker-compose)
