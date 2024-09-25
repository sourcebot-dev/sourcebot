
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
  <a href="https://demo.sourcebot.dev"><img src="https://img.shields.io/badge/Try the Demo!-blue?logo=googlechrome&logoColor=orange"/></a>
  <a href="mailto:brendan@sourcebot.dev"><img src="https://img.shields.io/badge/Email%20Us-brightgreen" /></a>
  <a href="https://github.com/TaqlaAI/sourcebot/blob/main/LICENSE"><img src="https://img.shields.io/github/license/TaqlaAI/sourcebot"/></a>
  <a href="https://github.com/TaqlaAI/sourcebot/actions/workflows/ghcr-publish.yml"><img src="https://img.shields.io/github/actions/workflow/status/TaqlaAI/sourcebot/ghcr-publish.yml"/><a>
  <a href="https://github.com/TaqlaAI/sourcebot/stargazers"><img src="https://img.shields.io/github/stars/TaqlaAI/sourcebot" /></a>
</p>


# About

Sourcebot is a fast code indexing and search tool for your codebases. It is built ontop of the [zoekt](https://github.com/sourcegraph/zoekt) indexer, originally authored by Han-Wen Nienhuys and now [maintained by Sourcegraph](https://sourcegraph.com/blog/sourcegraph-accepting-zoekt-maintainership).

![Demo video](https://github.com/user-attachments/assets/227176d8-fc61-42a9-8746-3cbc831f09e4)

# Getting Started

Before getting started, please make sure you install <a href="https://docs.docker.com/get-started/get-docker/"><img src="https://www.docker.com/favicon.ico" width="16" height="16"> Docker </a>. This is the only dependency required to get started using Sourcebot.

You can try out Sourcebot on your local machine without cloning the repo by running this simple command:

```
docker run -p 3000:3000 --rm --name sourcebot -e CONFIG_PATH=sample-config.json ghcr.io/taqlaai/sourcebot:main
```

Navigate to `localhost:3000` in your favorite web browser to see Sourcebot in action running on your own machine! This sample command will index the Sourcebot repository and allow you to search through it. If you'd like to run Sourcebot on a different repository, please read [Using Sourcebot on a custom repository](#using-sourcebot-on-a-custom-repository) !

<details>
<summary>What does this command do?</summary>

- Pull and run the Sourcebot docker image from [ghcr.io/taqlaai/sourcebot:main](ghcr.io/taqlaai/sourcebot:main)
- Set the `CONFIG_PATH` environment variable in the container to `sample-config.json`. Sourcebot loads the config file located at `CONFIG_PATH` to determine which repositories to index. To make things easier to try Sourcebot, we've baked in an [example](https://github.com/TaqlaAI/sourcebot/blob/main/sample-config.json) config file named `sample-config.json` into the published Docker image. 
- Map port 3000 between your machine and the docker image (`-p 3000:3000`). This is what allows you to run Sourcebot by navigating to `localhost:3000`
</details>

## Using Sourcebot on a custom repository

Sourcebot supports indexing and searching through public and private repositories hosted on <img src="https://github.com/favicon.ico" width="16" height="16" /> GitHub, <img src="https://gitlab.com/favicon.ico" width="16" height="16" />GitLab, and <img src="https://bitbucket.org/favicon.ico" width="16" height="16" /> BitBucket. This section will guide you through configure the repositories that Sourcebot indexes. 

### Create a Sourcebot workspace
The Sourcebot workspace is a directory on your machine that stores your Sourcebot config and cache data. To create a Sourcebot workspace, simply create a new directory on your machine (ex. `sourcebot_workspace`):

### Create a Sourcebot config
Sourcebot needs a config file to tell it which repositories to index. By default, Sourcebot will look for a file called `config.json` from within the workspace you mount.

From within your Sourcebot workspace, create a new file called `config.json` and paste in the following sample config which loads the `sourcebot` github repo:
```
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

TODO: add instructions here on how to change config
### Mount your workspace and run Sourcebot
Finally, we run Sourcebot but this time we mount the workspace folder so that it can pickup our custom config. 

> [!NOTE]
> This command assumes that you are running it from within your Sourcebot workspace. If you're not, replace `$(pwd)` below with the absolute path of your Sourcebot workspace

```
docker run -p 3000:3000 --rm --name sourcebot -v $(pwd):/data ghcr.io/taqlaai/sourcebot:main
```

### (Optional) Provide access token to index private repositories
TODO
### (Optional) Specifying a specific config file
TODO


--- 
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

    Generate a GitHub Personal Access Token (PAT) [here](https://github.com/settings/tokens/new). If you're only indexing public repositories select the `public_repo` scope; otherwise, select the `repo` scope.

    You'll need to pass this PAT each time you run Sourcebot, so we recommend adding it as an environment variable. In this guide, we'll add the Github PAT as an environment variable called `GITHUB_TOKEN`:
    ```sh
    export GITHUB_TOKEN=<your-token-here>
    ```

    If you'd like to persist this environment variable across shell sessions, please add this line to your shell config file (ex. `~/.bashrc`, `~/.bash_profile`, etc)
    

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

    Run the `sourcebot` docker image, passing in the Github PAT you generated in the previous step as an environment variable called `GITHUB_TOKEN`:
    ```sh
    docker run -p 3000:3000 --rm --name sourcebot -v $(pwd):/data -e GITHUB_TOKEN=$GITHUB_TOKEN ghcr.io/taqlaai/sourcebot:main
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

4. Go to `http://localhost:3000` - once an index has been created, you can start searching.

## Building Sourcebot

1. Install <a href="https://go.dev/doc/install"><img src="https://go.dev/favicon.ico" width="16" height="16"> go</a> and <a href="https://nodejs.org/"><img src="https://nodejs.org/favicon.ico" width="16" height="16"> NodeJS</a>. Note that a NodeJS version of at least `21.1.0` is required.

2. Install [ctags](https://github.com/universal-ctags/ctags) (required by zoekt-indexserver):
   Mac: `brew install universal-ctags`
   Ubuntu: `apt-get install universal-ctags`

3. Clone the repository with submodules:
    ```sh
    git clone --recurse-submodules https://github.com/TaqlaAI/sourcebot.git
    ```

4. Run make to build zoekt and install dependencies:
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

    Create a text file named `.github-token` **in your home directory** and paste the token in it. The file should look like:
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

6. Go to `http://localhost:3000` - once an index has been created, you can start searching.


## Telemetry

By default, Sourcebot collects anonymized usage data through [PostHog](https://posthog.com/) to help us improve the performance and reliability of our tool. We do not collect or transmit [any information related to your codebase](https://github.com/search?q=repo:TaqlaAI/sourcebot++captureEvent&type=code). All events are [sanitized](https://github.com/TaqlaAI/sourcebot/blob/main/src/app/posthogProvider.tsx) to ensure that no sensitive or identifying details leave your machine. The data we collect includes general usage statistics and metadata such as query performance (e.g., search duration, error rates) to monitor the application's health and functionality. This information helps us better understand how Sourcebot is used and where improvements can be made :)

If you'd like to disable all telemetry, you can do so by setting the environment variable `SOURCEBOT_TELEMETRY_DISABLED` to `1` in the docker run command:
```sh
docker run -e SOURCEBOT_TELEMETRY_DISABLED=1 /* additional args */ ghcr.io/taqlaai/sourcebot:main
```

Or if you are building locally, add the following to your [.env](./.env) file:
```sh
SOURCEBOT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED=1
```
