
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
            <strong>Demo</strong>
         </a>
      </h3>
   </div>

   <div>
      <a href="https://docs.sourcebot.dev/"><strong>Docs</strong></a> ·
      <a href="https://github.com/sourcebot-dev/sourcebot/issues"><strong>Report Bug</strong></a> ·
      <a href="https://github.com/sourcebot-dev/sourcebot/discussions/categories/ideas"><strong>Feature Request</strong></a> ·
      <a href="https://www.sourcebot.dev/changelog"><strong>Changelog</strong></a> ·
      <a href="https://www.sourcebot.dev/contact"><strong>Contact</strong></a> ·
   </div>
   <br/>
   <span>Sourcebot uses <a href="https://github.com/sourcebot-dev/sourcebot/discussions"><strong>Github Discussions</strong></a>  for Support and Feature Requests.</span>
   <br/>
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
<p align="center">
    <a href="https://discord.gg/6Fhp27x7Pb"><img src="https://dcbadge.limes.pink/api/server/https://discord.gg/6Fhp27x7Pb?style=flat"/></a>
</p>
</p>

# About

Sourcebot is a self-hosted tool that helps you understand your codebase. 

- Ask Sourcebot: Ask questions about your codebase and have Sourcebot provide detailed answers grounded with inline citations
- Code search: Search and navigate across all your repos and branches, no matter where they’re hosted

https://github.com/user-attachments/assets/286ad97a-a543-4eef-a2f1-4fa31bea1b32


## Features
- 💻 **One-command deployment**: Get started instantly using Docker on your own machine.
- 🤖 **Bring your own model**: Connect Sourcebot to any of the reasoning models you're already using.
- 🔍 **Multi-repo support**: Index and search through multiple public and private repositories and branches on GitHub, GitLab, Bitbucket, Gitea, or Gerrit.
- ⚡ **Lightning fast performance**: Built on top of the powerful [Zoekt](https://github.com/sourcegraph/zoekt) search engine.
- 🎨 **Modern web app**: Enjoy a sleek interface with features like syntax highlighting, light/dark mode, and vim-style navigation.
- 📂 **Full file visualization**: Instantly view the entire file when selecting any search result.

You can try out our public hosted demo [here](https://demo.sourcebot.dev)!

# Deploy Sourcebot

Sourcebot can be deployed in seconds using our official docker image. Visit our [docs](https://docs.sourcebot.dev/self-hosting/overview) for more information.

1. Create a config
```sh
touch config.json
echo '{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v3/index.json",
    "connections": {
        // Comments are supported
        "starter-connection": {
            "type": "github",
            "repos": [
                "sourcebot-dev/sourcebot"
            ]
        }
    }
}' > config.json
```

2. Run the docker container
```sh
docker run \
  -p 3000:3000 \
  --pull=always \
  --rm \
  -v $(pwd):/data \
  -e CONFIG_PATH=/data/config.json \
  --name sourcebot \
  ghcr.io/sourcebot-dev/sourcebot:latest
```
<details>
<summary>What does this command do?</summary>

- Pull and run the Sourcebot docker image from [ghcr.io/sourcebot-dev/sourcebot:latest](https://github.com/sourcebot-dev/sourcebot/pkgs/container/sourcebot).
- Mount the current directory (`-v $(pwd):/data`) to allow Sourcebot to persist the `.sourcebot` cache.
- Clones sourcebot at `HEAD` into `.sourcebot/github/sourcebot-dev/sourcebot`.
- Indexes sourcebot into a .zoekt index file in `.sourcebot/index/`.
- Map port 3000 between your machine and the docker image.
- Starts the web server on port 3000.
</details>
</br>

3. Start searching at `http://localhost:3000`
</br>

To learn how to configure Sourcebot to index your own repos, please refer to our [docs](https://docs.sourcebot.dev/self-hosting/overview).

> [!NOTE]
> Sourcebot collects <a href="https://demo.sourcebot.dev/~/search?query=captureEvent%5C(%20repo%3Asourcebot">anonymous usage data</a> by default to help us improve the product. No sensitive data is collected, but if you'd like to disable this you can do so by setting the `SOURCEBOT_TELEMETRY_DISABLED` environment
> variable to `true`. Please refer to our [telemetry docs](https://docs.sourcebot.dev/self-hosting/overview#telemetry) for more information.

# Build from source
>[!NOTE]
> Building from source is only required if you'd like to contribute. If you'd just like to use Sourcebot, we recommend checking out our self-hosting [docs](https://docs.sourcebot.dev/self-hosting/overview).

If you'd like to build from source, please checkout the `CONTRIBUTING.md` file for more information.

