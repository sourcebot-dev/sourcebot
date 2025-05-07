# Sourcebot MCP - Blazingly fast agentic code search for GitHub, GitLab, BitBucket, and more

[![Sourcebot](https://img.shields.io/badge/Website-sourcebot.dev-blue)](https://sourcebot.dev)
[![GitHub](https://img.shields.io/badge/GitHub-sourcebot--dev%2Fsourcebot-green?logo=github)](https://github.com/sourcebot-dev/sourcebot)
[![Docs](https://img.shields.io/badge/Docs-docs.sourcebot.dev-yellow)](https://docs.sourcebot.dev/docs/more/mcp-server)
[![npm](https://img.shields.io/npm/v/@sourcebot/mcp)](https://www.npmjs.com/package/@sourcebot/mcp)


The Sourcebot MCP server enables precise regular expression code search across repos hosted on [GitHub](https://docs.sourcebot.dev/docs/connections/github), [GitLab](https://docs.sourcebot.dev/docs/connections/gitlab), [BitBucket](https://docs.sourcebot.dev/docs/connections/bitbucket-cloud) and [more](#supported-code-hosts). This unlocks the capability for LLM agents to fetch code context for repositories that aren't checked out locally. Some use cases where precise search on a wider code context can help:

- Enriching responses to user requests:
    - _"What repositories are using internal library X?"_
    - _"Provide usage examples of the CodeMirror component"_
    - _"Where is the `useCodeMirrorTheme` hook defined?"_
    - _"Find all usages of `deprecatedApi` across all repos"_

- Improving reasoning ability for existing horizontal agents like AI code review, docs generation, etc.
    - _"Find the definitions for all functions in this diff"_
    - _"Document what systems depend on this class"_

- Building custom LLM horizontal agents like like compliance auditing agents, migration agents, etc.
    - _"Find all instances of hardcoded credentials"_
    - _"Identify repositories that depend on this depreacted api"_


## Getting Started

1. Install Node.JS >= v18.0.0.

2. (optional) Spin up a Sourcebot instance by following [this guide](https://docs.sourcebot.dev/self-hosting/overview). The host url of your instance (e.g., `http://localhost:3000`) is passed to the MCP server via the `SOURCEBOT_HOST` url.

    If a host is not provided, then the server will fallback to using the demo instance hosted at https://demo.sourcebot.dev. You can see the list of repositories indexed [here](https://demo.sourcebot.dev/~/repos). Add additional repositories by [opening a PR](https://github.com/sourcebot-dev/sourcebot/blob/main/demo-site-config.json).

3. Install `@sourcebot/mcp` into your MCP client:

    <details>
    <summary>Cursor</summary>

    [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol)

    Go to: `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`

    Paste the following into your `~/.cursor/mcp.json` file. This will install Sourcebot globally within Cursor:

    ```json
    {
        "mcpServers": {
            "sourcebot": {
                "command": "npx",
                "args": ["-y", "@sourcebot/mcp@latest" ],
                // Optional - if not specified, https://demo.sourcebot.dev is used
                "env": {
                    "SOURCEBOT_HOST": "http://localhost:3000"
                }
            }
        }
    }
    ```
    </details>

    <details>
    <summary>Windsurf</summary>

    [Windsurf MCP docs](https://docs.windsurf.com/windsurf/mcp)

    Go to: `Windsurf Settings` -> `Cascade` -> `Add Server` -> `Add Custom Server`

    Paste the following into your `mcp_config.json` file:

    ```json
    {
        "mcpServers": {
            "sourcebot": {
                "command": "npx",
                "args": ["-y", "@sourcebot/mcp@latest" ],
                // Optional - if not specified, https://demo.sourcebot.dev is used
                "env": {
                    "SOURCEBOT_HOST": "http://localhost:3000"
                }
            }
        }
    }
    ```
    </details>

    <details>
    <summary>VS Code</summary>

    [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)

    Add the following to your [settings.json](https://code.visualstudio.com/docs/copilot/chat/mcp-servers):

    ```json
    {
        "mcp": {
            "servers": {
                "sourcebot": {
                    "type": "stdio",
                    "command": "npx",
                    "args": ["-y", "@sourcebot/mcp@latest"],
                    // Optional - if not specified, https://demo.sourcebot.dev is used
                    "env": {
                        "SOURCEBOT_HOST": "http://localhost:3000"
                    }
                }
            }
        }
    }
    ```

    </details>

    <details>
    <summary>Claude Code</summary>

    [Claude Code MCP docs](https://docs.anthropic.com/en/docs/claude-code/tutorials#set-up-model-context-protocol-mcp)

    Run the following command:

    ```sh
    # SOURCEBOT_HOST env var is optional - if not specified,
    # https://demo.sourcebot.dev is used.
    claude mcp add sourcebot -e SOURCEBOT_HOST=http://localhost:3000 -- npx -y @sourcebot/mcp@latest
    ```
    </details>

    <details>
    <summary>Claude Desktop</summary>

    [Claude Desktop MCP docs](https://modelcontextprotocol.io/quickstart/user)

    Add the following to your `claude_desktop_config.json`:

    ```json
    {
        "mcpServers": {
            "sourcebot": {
                "command": "npx",
                "args": ["-y", "@sourcebot/mcp@latest"],
                // Optional - if not specified, https://demo.sourcebot.dev is used
                "env": {
                    "SOURCEBOT_HOST": "http://localhost:3000"
                }
            }
        }
    }
    ```
    </details>
<br/>

4. Tell your LLM to `use sourcebot` when prompting.

<br/>

For a more detailed guide, checkout [the docs](https://docs.sourcebot.dev/docs/more/mcp-server).


## Available Tools

### search_code

Fetches code that matches the provided regex pattern in `query`.

<details>
<summary>Parameters</summary>

| Name                  | Required | Description                                                                                                                       |
|:----------------------|:---------|:----------------------------------------------------------------------------------------------------------------------------------|
| `query`               | yes      | Regex pattern to search for. Escape special characters and spaces with a single backslash (e.g., 'console\.log', 'console\ log'). |
| `filterByRepoIds`     | no       | Restrict search to specific repository IDs (from 'list_repos'). Leave empty to search all.                                        |
| `filterByLanguages`   | no       | Restrict search to specific languages (GitHub linguist format, e.g., Python, JavaScript).                                         |
| `caseSensitive`       | no       | Case sensitive search (default: false).                                                                                           |
| `includeCodeSnippets` | no       | Include code snippets in results (default: false).                                                                                |
| `maxTokens`           | no       | Max tokens to return (default: env.DEFAULT_MINIMUM_TOKENS).                                                                       |
</details>


### list_repos

Lists all repositories indexed by Sourcebot.

### get_file_source

Fetches the source code for a given file.

<details>
<summary>Parameters</summary>

| Name         | Required | Description                                                      |
|:-------------|:---------|:-----------------------------------------------------------------|
| `fileName`   | yes      | The file to fetch the source code for.                           |
| `repoId`     | yes      | The Sourcebot repository ID.                                     |
</details>


## Supported Code Hosts
Sourcebot supports the following code hosts:
- [GitHub](https://docs.sourcebot.dev/docs/connections/github)
- [GitLab](https://docs.sourcebot.dev/docs/connections/gitlab)
- [Bitbucket Cloud](https://docs.sourcebot.dev/docs/connections/bitbucket-cloud)
- [Bitbucket Data Center](https://docs.sourcebot.dev/docs/connections/bitbucket-data-center)
- [Gitea](https://docs.sourcebot.dev/docs/connections/gitea)
- [Gerrit](https://docs.sourcebot.dev/docs/connections/gerrit)

| Don't see your code host? Open a [GitHub discussion](https://github.com/sourcebot-dev/sourcebot/discussions/categories/ideas).

## Future Work

### Semantic Search

Currently, Sourcebot only supports regex-based code search (powered by [zoekt](https://github.com/sourcegraph/zoekt) under the hood). It is great for scenarios when the agent is searching for is something that is super precise and well-represented in the source code (e.g., a specific function name, a error string, etc.). It is not-so-great for _fuzzy_ searches where the objective is to find some loosely defined _category_ or _concept_ in the code (e.g., find code that verifies JWT tokens). The LLM can approximate this by crafting regex searches that attempt to capture a concept (e.g., it might try a query like `"jwt|token|(verify|validate).*(jwt|token)"`), but often yields sub-optimal search results that aren't related. Tools like Cursor solve this with [embedding models](https://docs.cursor.com/context/codebase-indexing) to capture the semantic meaning of code, allowing for LLMs to search using natural language. We would like to extend Sourcebot to support semantic search and expose this capability over MCP as a tool (e.g., `semantic_search_code` tool). [GitHub Discussion](https://github.com/sourcebot-dev/sourcebot/discussions/297)

### Code Navigation

Another idea is to allow LLMs to traverse abstract syntax trees (ASTs) of a codebase to enable reliable code navigation. This could be packaged as tools like `goto_definition`, `find_all_references`, etc., which could be useful for LLMs to get additional code context. [GitHub Discussion](https://github.com/sourcebot-dev/sourcebot/discussions/296)

### Got an idea?

Open up a [GitHub discussion](https://github.com/sourcebot-dev/sourcebot/discussions/categories/feature-requests)!
