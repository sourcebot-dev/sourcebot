
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/logo_dark.png">
  <img height="150" src=".github/images/logo_light.png">
</picture>
</div>
<div align="center">
   <div>
      <h3>
         <a href="https://docs.sourcebot.dev/self-hosting/overview">
            <strong>Self Host</strong>
         </a> · 
         <a href="https://demo.sourcebot.dev">
            <strong>Public Demo</strong>
         </a>
      </h3>
   </div>

   <div>
      <a href="https://docs.sourcebot.dev/"><strong>Docs</strong></a> ·
      <a href="https://github.com/sourcebot-dev/sourcebot/issues/459"><strong>Roadmap</strong></a> ·
      <a href="https://github.com/sourcebot-dev/sourcebot/issues/new?template=bug_report.yml"><strong>Report Bug</strong></a> ·
      <a href="https://github.com/sourcebot-dev/sourcebot/issues/new?template=feature_request.md"><strong>Feature Request</strong></a> ·
      <a href="https://www.sourcebot.dev/changelog"><strong>Changelog</strong></a>
   </div>
   <br/>
   <div>
   </div>
</div>
<p align="center">
  <a href="mailto:team@sourcebot.dev"><img src="https://img.shields.io/badge/Email%20Us-brightgreen" /></a>
  <a href="https://github.com/sourcebot-dev/sourcebot/actions/workflows/ghcr-publish.yml"><img src="https://img.shields.io/github/actions/workflow/status/sourcebot-dev/sourcebot/ghcr-publish.yml"/><a>
  <a href="https://github.com/sourcebot-dev/sourcebot/stargazers"><img src="https://img.shields.io/github/stars/sourcebot-dev/sourcebot" /></a>
</p>
<p align="center">
</p>

Sourcebot is a self-hosted tool that helps you understand your codebase. 

- **Ask Sourcebot:** Ask questions about your codebase and have Sourcebot provide detailed answers grounded with inline citations.
- **Code search:** Search and navigate across all your repos and branches, no matter where they’re hosted.

Try it out in our [public demo](https://demo.sourcebot.dev)!

https://github.com/user-attachments/assets/ed66a622-e38f-4947-a531-86df1e1e0218

# Features
![Sourcebot Features](https://github.com/user-attachments/assets/3aed7348-7aeb-4af3-89da-b617c3db2e02)

## Ask Sourcebot
Ask Sourcebot gives you the ability to ask complex questions about your codebase in natural language.

It uses Sourcebot's existing code search and navigation tools to allow reasoning models to search your code, follow code nav references, and provide an answer that's rich with inline citations and navigable code snippets.

https://github.com/user-attachments/assets/8212cd16-683f-468f-8ea5-67455c0931e2

## Code Search
Search across all your repos/branches across any code host platform. Blazingly fast, and supports regular expressions, repo/language search filters, boolean logic, and more.

https://github.com/user-attachments/assets/3b381452-d329-4949-b6f2-2fc38952e481

## Code Navigation
IDE-level code navigation (goto definition and find references) across all your repos.

https://github.com/user-attachments/assets/e2da2829-71cc-40af-98b4-7ba52e945530

## Built-in File Explorer
Explore every file across all of your repos. Modern UI with syntax highlighting, file tree, code navigation, etc.

https://github.com/user-attachments/assets/31ec0669-707d-4e03-b511-1bc33d44197a

# Deploy Sourcebot

Sourcebot can be deployed in seconds using Docker Compose. Visit our [docs](https://docs.sourcebot.dev/docs/deployment/docker-compose) for more information.

1. Download the docker-compose.yml file
```sh
curl -o docker-compose.yml https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/docker-compose.yml
```

2. In the same directory as the `docker-compose.yml` file, create a [configuration file](https://docs.sourcebot.dev/docs/configuration/config-file). The configuration file is a JSON file that configures Sourcebot's behaviour, including what repositories to index, language model providers, auth providers, and more.
```sh
touch config.json
echo '{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v3/index.json",
    // Comments are supported.
    // This config creates a single connection to GitHub.com that
    // indexes the Sourcebot repository
    "connections": {
        "starter-connection": {
            "type": "github",
            "repos": [
                "sourcebot-dev/sourcebot"
            ]
        }
    }
}' > config.json
```

3.  Update the secrets in the `docker-compose.yml` and then run Sourcebot using:
```sh
docker compose up
```

4. Visit `http://localhost:3000` to start using Sourcebot
</br>

To configure Sourcebot (index your own repos, connect your LLMs, etc), check out our [docs](https://docs.sourcebot.dev/docs/configuration/config-file).

> [!NOTE]
> Sourcebot collects <a href="https://demo.sourcebot.dev/~/search?query=captureEvent%5C(%20repo%3Asourcebot">anonymous usage data</a> by default to help us improve the product. No sensitive data is collected, but if you'd like to disable this you can do so by setting the `SOURCEBOT_TELEMETRY_DISABLED` environment
> variable to `true`. Please refer to our [telemetry docs](https://docs.sourcebot.dev/docs/overview#telemetry) for more information.

# Build from source
>[!NOTE]
> Building from source is only required if you'd like to contribute. If you'd just like to use Sourcebot, we recommend checking out our self-hosting [docs](https://docs.sourcebot.dev/self-hosting/overview).

If you'd like to build from source, please checkout the `CONTRIBUTING.md` file for more information.
