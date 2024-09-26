
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

## Features
- 💻 **One-command deployment**: Get started instantly using Docker on your own machine.
- 🔍 **Multi-repo search**: Effortlessly index and search through multiple public and private repositories (GitHub, GitLab, BitBucket).
- ⚡**Lightning fast performance**: Built on top of the powerful [Zoekt](https://github.com/sourcegraph/zoekt) search engine.
- 📂 **Full file visualization**: Instantly view the entire file when selecting any search result.
- 🎨 **Modern web application**: Enjoy a sleek interface with features like syntax highlighting, light/dark mode, and vim-style navigation 

You can try out our public hosted demo [here](https://demo.sourcebot.dev/)!

# Getting Started

Get started with a single docker command:

```
docker run -p 3000:3000 --rm --name sourcebot -e CONFIG_PATH=sample-config.json ghcr.io/taqlaai/sourcebot:main
```

Navigate to `localhost:3000` to start searching the Sourcebot repo. Want to search your own repos? Checkout how to [configure Sourcebot](#configuring-sourcebot).

<details>
<summary>What does this command do?</summary>

- Pull and run the Sourcebot docker image from [ghcr.io/taqlaai/sourcebot:main](ghcr.io/taqlaai/sourcebot:main). You'll need to make sure you have [docker installed](https://docs.docker.com/get-started/get-docker/) to do this.
- Set the `CONFIG_PATH` environment variable in the container to `sample-config.json`. Sourcebot loads the config file located at `CONFIG_PATH` to determine which repositories to index. To make things easier to try Sourcebot, we've baked in an [example](https://github.com/TaqlaAI/sourcebot/blob/main/sample-config.json) config file named `sample-config.json` into the published Docker image. 
- Map port 3000 between your machine and the docker image (`-p 3000:3000`).
</details>

## Configuring Sourcebot

Sourcebot supports indexing and searching through public and private repositories hosted on 
<picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/images/github-favicon-inverted.png">
    <img src="https://github.com/favicon.ico" width="16" height="16" alt="GitHub icon">
</picture> GitHub,
<img src="https://gitlab.com/favicon.ico" width="16" height="16" />GitLab, and 
<img src="https://bitbucket.org/favicon.ico" width="16" height="16" /> BitBucket. This section will guide you through configuring the repositories that Sourcebot indexes. 

1. Create a new folder on your machine that stores your configs and `.sourcebot` cache, and navigate into it:
```
mkdir sourcebot_workspace
cd sourcebot_workspace
```

2. Create a new config following the [configuration schema](https://raw.githubusercontent.com/TaqlaAI/sourcebot/main/schemas/index.json) to specify which repositories Sourcebot should index. For example to index Sourcebot itself:

```
touch my_config.json
echo `{
    "$schema": "https://raw.githubusercontent.com/TaqlaAI/sourcebot/main/schemas/index.json",
    "Configs": [
        {
            "Type": "github",
            "GitHubOrg": "TaqlaAI",
            "Name": "sourcebot"
        }
    ]
}` > my_config.json
```

3. Run Sourcebot and point it to the new config you created:

```
docker run -p 3000:3000 --rm --name sourcebot -e CONFIG_PATH=./my_config.json -v $(pwd):/data ghcr.io/taqlaai/sourcebot:main
```

This command will also mount the current directory (`-v $(pwd):/data`) to allow Sourcebot to persist the `.sourcebot` cache. 

### (Optional) Provide an access token to index private repositories
In order to allow Sourcebot to index your private repositories, you must provide it with an access token.

<div>
<details>
<summary>
<picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/images/github-favicon-inverted.png">
    <img src="https://github.com/favicon.ico" width="16" height="16" alt="GitHub icon">
</picture> GitHub
</summary>

Generate a GitHub Personal Access Token (PAT) [here](https://github.com/settings/tokens/new) and make sure you select the `repo` scope.

You'll need to pass this PAT each time you run Sourcebot by setting the GITHUB_TOKEN environment variable:

<pre>
docker run -p 3000:3000 --rm --name sourcebot -e <b>GITHUB_TOKEN=[your-github-token]</b> -v $(pwd):/data ghcr.io/taqlaai/sourcebot:main
</pre>

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


## Build from source
>[!NOTE]
>You don't need to build Sourcebot in order to use it! If you'd just like to use Sourcebot, please read [how to configure Sourcebot](#configuring-sourcebot).

If you'd like to make changes to Sourcebot you'll need to build from source:

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
                "Name": "sourcebot"
            }
        ]
    }
    ```

4. Create a Personal Access Token (PAT) to authenticate with a code host:

    <div>
    <details open>
    <summary>
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset=".github/images/github-favicon-inverted.png">
        <img src="https://github.com/favicon.ico" width="16" height="16" alt="GitHub icon">
    </picture>
    GitHub
    </summary>    
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

By default, Sourcebot collects anonymized usage data through [PostHog](https://posthog.com/) to help us improve the performance and reliability of our tool. We do not collect or transmit [any information related to your codebase](https://github.com/search?q=repo:TaqlaAI/sourcebot++captureEvent&type=code). In addition, all events are [sanitized](https://github.com/TaqlaAI/sourcebot/blob/main/src/app/posthogProvider.tsx) to ensure that no sensitive or identifying details leave your machine. The data we collect includes general usage statistics and metadata such as query performance (e.g., search duration, error rates) to monitor the application's health and functionality. This information helps us better understand how Sourcebot is used and where improvements can be made :)

If you'd like to disable all telemetry, you can do so by setting the environment variable `SOURCEBOT_TELEMETRY_DISABLED` to `1` in the docker run command:

<pre>
docker run -e <b>SOURCEBOT_TELEMETRY_DISABLED=1</b> /* additional args */ ghcr.io/taqlaai/sourcebot:main
</pre>

Or if you are [building locally](#building-sourcebot), add the following to your [.env](./.env) file:
```sh
SOURCEBOT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED=1
```
