
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/logo_dark.png">
  <img height="150" src=".github/images/logo_light.png">
</picture>
</div>
<p align="center">
Blazingly fast code search 🏎️
</p>
<p align="center">
  <a href="https://sourcebot.dev/search"><img src="https://img.shields.io/badge/Try the Demo!-blue?logo=googlechrome&logoColor=orange"/></a>
  <a href="mailto:brendan@sourcebot.dev"><img src="https://img.shields.io/badge/Email%20Us-brightgreen" /></a>
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

Sourcebot is a fast code indexing and search tool for your codebases. It is built ontop of the [zoekt](https://github.com/sourcegraph/zoekt) indexer, originally authored by Han-Wen Nienhuys and now [maintained by Sourcegraph](https://sourcegraph.com/blog/sourcegraph-accepting-zoekt-maintainership).

https://github.com/user-attachments/assets/98d46192-5469-430f-ad9e-5c042adbb10d


## Features
- 💻 **One-command deployment**: Get started instantly using Docker on your own machine.
- 🔍 **Multi-repo search**: Effortlessly index and search through multiple public and private repositories in GitHub, GitLab, Gitea, or Gerrit.
- ⚡**Lightning fast performance**: Built on top of the powerful [Zoekt](https://github.com/sourcegraph/zoekt) search engine.
- 📂 **Full file visualization**: Instantly view the entire file when selecting any search result.
- 🎨 **Modern web app**: Enjoy a sleek interface with features like syntax highlighting, light/dark mode, and vim-style navigation 

You can try out our public hosted demo [here](https://sourcebot.dev/search)!

# Getting Started

Get started with a single docker command:

```
docker run -p 3000:3000 --rm --name sourcebot ghcr.io/sourcebot-dev/sourcebot:latest
```

Navigate to `localhost:3000` to start searching the Sourcebot repo. Want to search your own repos? Checkout how to [configure Sourcebot](#configuring-sourcebot).

<details>
<summary>What does this command do?</summary>

- Pull and run the Sourcebot docker image from [ghcr.io/sourcebot-dev/sourcebot:latest](https://github.com/sourcebot-dev/sourcebot/pkgs/container/sourcebot). Make sure you have [docker installed](https://docs.docker.com/get-started/get-docker/).
- Read the repos listed in [default config](./default-config.json) and start indexing them.
- Map port 3000 between your machine and the docker image.
- Starts the web server on port 3000.
</details>

## Configuring Sourcebot

Sourcebot supports indexing and searching through public and private repositories hosted on 
<picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/images/github-favicon-inverted.png">
    <img src="https://github.com/favicon.ico" width="16" height="16" alt="GitHub icon">
</picture> GitHub, <img src="https://gitlab.com/favicon.ico" width="16" height="16" /> GitLab, <img src="https://gitea.com/favicon.ico" width="16" height="16"> Gitea, and <img src="https://gerrit-review.googlesource.com/favicon.ico" width="16" height="16"> Gerrit. This section will guide you through configuring the repositories that Sourcebot indexes. 

1. Create a new folder on your machine that stores your configs and `.sourcebot` cache, and navigate into it:
    ```sh
    mkdir sourcebot_workspace
    cd sourcebot_workspace
    ```

2. Create a new config following the [configuration schema](./schemas/v2/index.json) to specify which repositories Sourcebot should index. For example, let's index llama.cpp:

    ```sh
    touch my_config.json
    echo '{
        "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v2/index.json",
        "repos": [
            {
                "type": "github",
                "repos": [
                    "ggerganov/llama.cpp"
                ]
            }
        ]
    }' > my_config.json
    ```

>[!NOTE] 
> Sourcebot can also index all repos owned by a organization, user, group, etc., instead of listing them individually. For examples, see the [configs](./configs) directory. For additional usage information, see the [configuration schema](./schemas/v2/index.json).

3. Run Sourcebot and point it to the new config you created with the `-e CONFIG_PATH` flag:

    ```sh
    docker run -p 3000:3000 --rm --name sourcebot -v $(pwd):/data -e CONFIG_PATH=/data/my_config.json ghcr.io/sourcebot-dev/sourcebot:latest
    ```

    <details>
    <summary>What does this command do?</summary>

    - Pull and run the Sourcebot docker image from [ghcr.io/sourcebot-dev/sourcebot:latest](https://github.com/sourcebot-dev/sourcebot/pkgs/container/sourcebot).
    - Mount the current directory (`-v $(pwd):/data`) to allow Sourcebot to persist the `.sourcebot` cache.
    - Mirrors (clones) llama.cpp at `HEAD` into `.sourcebot/github/ggerganov/llama.cpp`.
    - Indexes llama.cpp into a .zoekt index file in `.sourcebot/index/`.
    - Map port 3000 between your machine and the docker image.
    - Starts the web server on port 3000.
    </details>
    <br>

    You should see a `.sourcebot` folder in your current directory. This folder stores a cache of the repositories zoekt has indexed. The `HEAD` commit of a repository is re-indexed [every hour](./packages/backend/src/constants.ts). Indexing private repos? See [Providing an access token](#providing-an-access-token).
    
    </br>

## Providing an access token
This will depend on the code hosting platform you're using:

<div>
<details>
<summary>
<picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/images/github-favicon-inverted.png">
    <img src="https://github.com/favicon.ico" width="16" height="16" alt="GitHub icon">
</picture> GitHub
</summary>

In order to index private repositories, you'll need to generate a GitHub Personal Access Token (PAT). Create a new PAT [here](https://github.com/settings/tokens/new) and make sure you select the `repo` scope:

![GitHub PAT creation](.github/images/github-pat-creation.png)

Next, update your configuration with the `token` field:
```json
{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v2/index.json",
    "repos": [
        {
            "type": "github",
            "token": "ghp_mytoken",
            ...
        }
    ]
}
```

You can also pass tokens as environment variables:
```json
{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v2/index.json",
    "repos": [
        {
            "type": "github",
            "token": {
                // note: this env var can be named anything. It
                // doesn't need to be `GITHUB_TOKEN`.
                "env": "GITHUB_TOKEN"
            },
            ...
        }
    ]
}
```

You'll need to pass this environment variable each time you run Sourcebot:

<pre>
docker run -e <b>GITHUB_TOKEN=ghp_mytoken</b> /* additional args */ ghcr.io/sourcebot-dev/sourcebot:latest
</pre>
</details>

<details>
<summary><img src="https://gitlab.com/favicon.ico" width="16" height="16" /> GitLab</summary>

Generate a GitLab Personal Access Token (PAT) [here](https://gitlab.com/-/user_settings/personal_access_tokens) and make sure you select the `read_api` scope:

![GitLab PAT creation](.github/images/gitlab-pat-creation.png)

Next, update your configuration with the `token` field:
```json
{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v2/index.json",
    "repos": [
        {
            "type": "gitlab",
            "token": "glpat-mytoken",
            ...
        }
    ]
}
```

You can also pass tokens as environment variables:
```json
{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v2/index.json",
    "repos": [
        {
            "type": "gitlab",
            "token": {
                // note: this env var can be named anything. It
                // doesn't need to be `GITLAB_TOKEN`.
                "env": "GITLAB_TOKEN"
            },
            ...
        }
    ]
}
```

You'll need to pass this environment variable each time you run Sourcebot:

<pre>
docker run -e <b>GITLAB_TOKEN=glpat-mytoken</b> /* additional args */ ghcr.io/sourcebot-dev/sourcebot:latest
</pre>

</details>

<details>
<summary><img src="https://gitea.com/favicon.ico" width="16" height="16"> Gitea</summary>

Generate a Gitea access token [here](http://gitea.com/user/settings/applications). At minimum, you'll need to select the `read:repository` scope, but `read:user` and `read:organization` are required for the `user` and `org` fields of your config file:

![Gitea Access token creation](.github/images/gitea-pat-creation.png)

Next, update your configuration with the `token` field:
```json
{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v2/index.json",
    "repos": [
        {
            "type": "gitea",
            "token": "my-secret-token",
            ...
        }
    ]
}
```

You can also pass tokens as environment variables:
```json
{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v2/index.json",
    "repos": [
        {
            "type": "gitea",
            "token": {
                // note: this env var can be named anything. It
                // doesn't need to be `GITEA_TOKEN`.
                "env": "GITEA_TOKEN"
            },
            ...
        }
    ]
}
```

You'll need to pass this environment variable each time you run Sourcebot:

<pre>
docker run -e <b>GITEA_TOKEN=my-secret-token</b> /* additional args */ ghcr.io/sourcebot-dev/sourcebot:latest
</pre>

</details>

<details>
<summary><img src="https://gerrit-review.googlesource.com/favicon.ico" width="16" height="16"> Gerrit</summary>
Gerrit authentication is not yet currently supported.
</details>


</div>

## Using a self-hosted GitLab / GitHub instance

If you're using a self-hosted GitLab or GitHub instance with a custom domain, you can specify the domain in your config file. See [configs/self-hosted.json](configs/self-hosted.json) for examples.

## Searching multiple branches

By default, Sourcebot will index the default branch. To configure Sourcebot to index multiple branches (or tags), the `revisions` field can be used:

```jsonc
{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v2/index.json",
    "repos": [
        {
            "type": "github",
            "revisions": {
                // Index the `main` branch and any branches matching the `releases/*` glob pattern.
                "branches": [
                    "main",
                    "releases/*"
                ],
                // Index the `latest` tag and any tags matching the `v*.*.*` glob pattern.
                "tags": [
                    "latest",
                    "v*.*.*"
                ]
            },
            "repos": [
                "my_org/repo_a",
                "my_org/repo_b"
            ]
        }
    ]
}
```

For each repository (in this case, `repo_a` and `repo_b`), Sourcebot will index all branches and tags matching the `branches` and `tags` patterns provided. Any branches or tags that don't match the patterns will be ignored and not indexed.

To search on a specific revision, use the `revision` filter in the search bar:

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/revisions_filter_dark.png">
  <img style="max-width:700px;width:100%" src=".github/images/revisions_filter_light.png">
</picture>

## Searching a local directory

Local directories can be searched by using the `local` type in your config file:

```jsonc
{
    "$schema": "https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v2/index.json",
    "repos": [
        {
            "type": "local",
            "path": "/repos/my-repo",
            // re-index files when a change is detected
            "watch": true,
            "exclude": {
                // exclude paths from being indexed
                "paths": [
                    "node_modules",
                    "build"
                ]
            }
        }
    ]
}
```

You'll need to mount the directory as a volume when running Sourcebot:

<pre>
docker run <b>-v /path/to/my-repo:/repos/my-repo</b> /* additional args */ ghcr.io/sourcebot-dev/sourcebot:latest
</pre>

## Build from source
>[!NOTE]
> Building from source is only required if you'd like to contribute. The recommended way to use Sourcebot is to use the [pre-built docker image](https://github.com/sourcebot-dev/sourcebot/pkgs/container/sourcebot).

1. Install <a href="https://go.dev/doc/install"><img src="https://go.dev/favicon.ico" width="16" height="16"> go</a> and <a href="https://nodejs.org/"><img src="https://nodejs.org/favicon.ico" width="16" height="16"> NodeJS</a>. Note that a NodeJS version of at least `21.1.0` is required.

2. Install [ctags](https://github.com/universal-ctags/ctags) (required by zoekt)
    ```sh
    // macOS:
    brew install universal-ctags

    // Linux:
    snap install universal-ctags
    ```

3. Clone the repository with submodules:
    ```sh
    git clone --recurse-submodules https://github.com/sourcebot-dev/sourcebot.git
    ```

4. Run `make` to build zoekt and install dependencies:
    ```sh
    cd sourcebot
    make
    ```

    The zoekt binaries and web dependencies are placed into `bin` and `node_modules` respectively.

5. Create a `config.json` file at the repository root. See [Configuring Sourcebot](#configuring-sourcebot) for more information.

6. Start Sourcebot with the command:
    ```sh
    yarn dev
    ```

    A `.sourcebot` directory will be created and zoekt will begin to index the repositories found given `config.json`.

7. Start searching at `http://localhost:3000`.

## Telemetry

By default, Sourcebot collects anonymized usage data through [PostHog](https://posthog.com/) to help us improve the performance and reliability of our tool. We do not collect or transmit [any information related to your codebase](https://sourcebot.dev/search/search?query=captureEvent%20repo%3Asourcebot%20case%3Ano). In addition, all events are [sanitized](./packages/web/src/app/posthogProvider.tsx) to ensure that no sensitive or identifying details leave your machine. The data we collect includes general usage statistics and metadata such as query performance (e.g., search duration, error rates) to monitor the application's health and functionality. This information helps us better understand how Sourcebot is used and where improvements can be made :)

If you'd like to disable all telemetry, you can do so by setting the environment variable `SOURCEBOT_TELEMETRY_DISABLED` to `1` in the docker run command:

<pre>
docker run -e <b>SOURCEBOT_TELEMETRY_DISABLED=1</b> /* additional args */ ghcr.io/sourcebot-dev/sourcebot:latest
</pre>

Or if you are [building locally](#build-from-source), create a `.env.local` file at the repository root with the following contents:
```sh
SOURCEBOT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED=1
```

## Attributions

Sourcebot makes use of the following libraries:

- [@vscode/codicons](https://github.com/microsoft/vscode-codicons) under the [CC BY 4.0 License](https://github.com/microsoft/vscode-codicons/blob/main/LICENSE).
