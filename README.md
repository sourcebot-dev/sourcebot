
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/logo_dark.png">
  <img height="150" src=".github/images/logo_light.png">
</picture>
</div>
<div align="center">
   <div>
      <h3>
         <a href="https://app.sourcebot.dev">
            <strong>Sourcebot Cloud</strong>
         </a> · 
         <a href="https://docs.sourcebot.dev/self-hosting/overview">
            <strong>Self Host</strong>
         </a> · 
         <a href="https://sourcebot.dev/search">
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
  <a href="https://github.com/sourcebot-dev/sourcebot/blob/main/LICENSE"><img src="https://img.shields.io/github/license/sourcebot-dev/sourcebot"/></a>
  <a href="https://github.com/sourcebot-dev/sourcebot/actions/workflows/ghcr-publish.yml"><img src="https://img.shields.io/github/actions/workflow/status/sourcebot-dev/sourcebot/ghcr-publish.yml"/><a>
  <a href="https://github.com/sourcebot-dev/sourcebot/stargazers"><img src="https://img.shields.io/github/stars/sourcebot-dev/sourcebot" /></a>
</p>
<p align="center">
<p align="center">
    <a href="https://discord.gg/6Fhp27x7Pb"><img src="https://dcbadge.limes.pink/api/server/https://discord.gg/6Fhp27x7Pb?style=flat"/></a>
</p>
</p>

# About

Sourcebot is the open source Sourcegraph alternative. Index all your repos and branches across multiple code hosts (GitHub, GitLab, Gitea, or Gerrit) and search through them using a blazingly fast interface.

https://github.com/user-attachments/assets/98d46192-5469-430f-ad9e-5c042adbb10d


## Features
- 💻 **One-command deployment**: Get started instantly using Docker on your own machine.
- 🔍 **Multi-repo search**: Index and search through multiple public and private repositories and branches on GitHub, GitLab, Gitea, or Gerrit.
- ⚡**Lightning fast performance**: Built on top of the powerful [Zoekt](https://github.com/sourcegraph/zoekt) search engine.
- 🎨 **Modern web app**: Enjoy a sleek interface with features like syntax highlighting, light/dark mode, and vim-style navigation 
- 📂 **Full file visualization**: Instantly view the entire file when selecting any search result.

You can try out our public hosted demo [here](https://sourcebot.dev/search)!

# Deply Sourcebot

Sourcebot can be deployed in seconds using our official docker image. Visit our [docs](https://docs.sourcebot.dev/self-hosting/overview) for more information.

1. Create a config
```json
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
}' > config.jsono
```

2. Run the docker container
```sh
docker run -p 3000:3000 --pull=always --rm -v $(pwd):/data -e CONFIG_PATH=/data/config.json --name sourcebot ghcr.io/sourcebot-dev/sourcebot:latest
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
> Sourcebot collects [anonymous usage data](https://sourcebot.dev/search/search?query=captureEvent%5C(%20repo%3Asourcebot) by default to help us improve the product. No sensitive data is collected, but if you'd like to disable this you can do so by setting the `SOURCEBOT_TELEMETRY_DISABLED` environment
> variable to `false`. Please refer to our [telemetry docs](https://docs.sourcebot.dev/self-hosting/overview#telemetry) for more information.

# Build from source
>[!NOTE]
> Building from source is only required if you'd like to contribute. If you'd just like to use Sourcebot, we recommend checking out our self-hosting [docs](https://docs.sourcebot.dev/self-hosting/overview).

If you'd like to build from source, please checkout the `CONTRIBUTING.md` file for more information.

