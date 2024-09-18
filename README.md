<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/logo_dark.png">
  <img src=".github/images/logo_light.png">
</picture>

[Try the demo!](https://demo.sourcebot.dev)


# About
![build](https://github.com/TaqlaAI/sourcebot/actions/workflows/ghcr-publish.yml/badge.svg)

Sourcebot is a fast code indexing and search tool for your codebases. It is built ontop of the [zoekt](https://github.com/sourcegraph/zoekt) indexer, originally authored by Han-Wen Nienhuys and now [maintained by Sourcegraph](https://sourcegraph.com/blog/sourcegraph-accepting-zoekt-maintainership).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/usage_dark.png">
  <img src=".github/images/usage_light.png">
</picture>
<br/>
<br/>

# Getting Started

## Using Docker


0. Install <a href="https://docs.docker.com/get-started/get-docker/"><img src="https://www.docker.com/favicon.ico" width="16" height="16"> Docker </a>

1. Create a `config.json` file and list the repositories you want to index. The JSON schema [index.json](./schemas/index.json) defines the structure of the config file and the available options. For example, if we want to index Sourcebot on its own code, we could use the following config found in `sample-config.json`:

    ```json
    {
        "$schema": "https://raw.githubusercontent.com/TaqlaAI/sourcebot/main/schemas/index.json",
        "Configs": [
            {
                "Type": "github",
                "GitHubOrg": "TaqlaAI",
                "Name": "^sourcebot$"
            }
        ]
    }
    ```

Sourcebot also supports indexing GitLab & BitBucket. Checkout the [index.json](./schemas/index.json) for a full list of available options.

2. Create a Personal Access Token (PAT) to authenticate with a code host(s):

    <div>
    <details open>
    <summary><img src="https://github.com/favicon.ico" width="16" height="16" /> GitHub</summary>

    Generate a GitHub Personal Access Token (PAT) [here](https://github.com/settings/tokens/new). If you are indexing public repositories only, you can select the `public_repo` scope, otherwise you will need the `repo` scope.

    </details>

    <details>
    <summary><img src="https://gitlab.com/favicon.ico" width="16" height="16" /> GitLab</summary>
    
    TODO

    </details>

    <details>
    <summary><img src="https://bitbucket.org/favicon.ico" width="16" height="16" /> BitBucket</summary>

    TODO

    </details>
    </div>

3. Launch the latest image from the [ghcr registry](https://github.com/TaqlaAI/sourcebot/pkgs/container/sourcebot):

    <div>
    <details open>
    <summary><img src="https://github.com/favicon.ico" width="16" height="16" /> GitHub</summary>

    ```sh
    docker run -p 3000:3000 --rm --name sourcebot -v $(pwd):/data -e GITHUB_TOKEN=<token> ghcr.io/taqlaai/sourcebot:main
    ```
    </details>

    <details>
    <summary><img src="https://gitlab.com/favicon.ico" width="16" height="16" /> GitLab</summary>

    ```sh
    docker run -p 3000:3000 --rm --name sourcebot -v $(pwd):/data -e GITLAB_TOKEN=<token> ghcr.io/taqlaai/sourcebot:main
    ```

    </details>

    <details>
    <summary><img src="https://bitbucket.org/favicon.ico" width="16" height="16" /> BitBucket</summary>

    TODO

    </details>
    </div>

    Two things should happen: (1) a `.sourcebot` directory will be created containing the mirror repositories and indexes, and (2) you will see output similar to:

    ```sh
    INFO spawned: 'node-server' with pid 10
    INFO spawned: 'zoekt-indexserver' with pid 11
    INFO spawned: 'zoekt-webserver' with pid 12
    run [zoekt-mirror-github -dest /data/.sourcebot/repos -delete -org <org>]
    ...
    INFO success: node-server entered RUNNING state, process has stayed up for > than 1 seconds (startsecs)
    INFO success: zoekt-indexserver entered RUNNING state, process has stayed up for > than 1 seconds (startsecs)
    INFO success: zoekt-webserver entered RUNNING state, process has stayed up for > than 1 seconds (startsecs)
    ```

    zoekt will now index your repositories (at `HEAD`). By default, it will re-index existing repositories every hour, and discover new repositories every 24 hours.

4. Go to `http://localhost:3000` - once a index has been created, you can start searching.

## Building Sourcebot

0. Install <a href="https://go.dev/"><img src="https://go.dev/favicon.ico" width="16" height="16"> go</a> and <a href="https://nodejs.org/"><img src="https://nodejs.org/favicon.ico" width="16" height="16"> NodeJS</a>

1. Clone the repository with submodules:
    ```sh
    git clone --recurse-submodules https://github.com/TaqlaAI/sourcebot.git
    ```

2. Run make to build zoekt and install dependencies:
    ```sh
    cd sourcebot
    make
    ```

The zoekt binaries and web dependencies are placed into `bin` and `node_modules` respectively.

3. Create a `config.json` file and list the repositories you want to index. The JSON schema defined in [index.json](./schemas/index.json) defines the structure of the config file and the available options. For example, if we want to index Sourcebot on its own code, we could use the following config found in `sample-config.json`:

    ```json
    {
        "$schema": "https://raw.githubusercontent.com/TaqlaAI/sourcebot/main/schemas/index.json",
        "Configs": [
            {
                "Type": "github",
                "GitHubOrg": "TaqlaAI",
                "Name": "^sourcebot$"
            }
        ]
    }
    ```

4. Create a Personal Access Token (PAT) to authenticate with a code host:

    <div>
    <details open>
    <summary><img src="https://github.com/favicon.ico" width="16" height="16" /> GitHub</summary>
    
    Generate a GitHub Personal Access Token (PAT) [here](https://github.com/settings/tokens/new). If you are indexing public repositories only, you can select the `public_repo` scope, otherwise you will need the `repo` scope.

    Create a text file named `.github-token` in your home directory and paste the token in it. The file should look like:
    ```sh
    ghp_...
    ```
    zoekt will [read this file](https://github.com/TaqlaAI/zoekt/blob/6a5753692b46e669f851ab23211e756a3677185d/cmd/zoekt-mirror-github/main.go#L60) to authenticate with GitHub.
    </details>

    <details>
    <summary><img src="https://gitlab.com/favicon.ico" width="16" height="16" /> GitLab</summary>
    TODO
    </details>

    <details>
    <summary><img src="https://bitbucket.org/favicon.ico" width="16" height="16" /> BitBucket</summary>
    TODO
    </details>
    </div>

5. Start Sourcebot with the command:
    ```sh
    yarn dev
    ```

    A `.sourcebot` directory will be created and zoekt will begin to index the repositories found given `config.json`.

6. Go to `http://localhost:3000` - once a index has been created, you can start searching.


## Disabling Telemetry

By default, Sourcebot collects anonymous usage data using [PostHog](https://posthog.com/). You can disable this by setting the environment variable `SOURCEBOT_TELEMETRY_DISABLED` to `1` in the docker run command:
```sh
docker run -e SOURCEBOT_TELEMETRY_DISABLED=1 ...stuff... ghcr.io/taqlaai/sourcebot:main
```

Or if you are building locally, add the following to your [.env](./.env) file:
```sh
SOURCEBOT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED=1
```
