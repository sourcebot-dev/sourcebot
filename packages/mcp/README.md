# Sourcebot MCP - Fetch code context from GitHub, GitLab, Bitbucket, and more

[![Sourcebot](https://img.shields.io/badge/Website-sourcebot.dev-blue)](https://sourcebot.dev)
[![GitHub](https://img.shields.io/badge/GitHub-sourcebot--dev%2Fsourcebot-green?logo=github)](https://github.com/sourcebot-dev/sourcebot)
[![Docs](https://img.shields.io/badge/Docs-docs.sourcebot.dev-yellow)](https://docs.sourcebot.dev/docs/features/mcp-server)
[![npm](https://img.shields.io/npm/v/@sourcebot/mcp)](https://www.npmjs.com/package/@sourcebot/mcp)

The Sourcebot MCP server gives your LLM agents the ability to fetch code context across thousands of repos hosted on [GitHub](https://docs.sourcebot.dev/docs/connections/github), [GitLab](https://docs.sourcebot.dev/docs/connections/gitlab), [BitBucket](https://docs.sourcebot.dev/docs/connections/bitbucket-cloud) and [more](#supported-code-hosts). Ask your LLM a question, and the Sourcebot MCP server will fetch relevant context from its index and inject it into your chat session. Some use cases this unlocks include:

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
    - _"Identify repositories that depend on this deprecated api"_


## Getting Started

1. Install Node.JS >= v18.0.0.

2. (optional) Spin up a Sourcebot instance by following [this guide](https://docs.sourcebot.dev/self-hosting/overview). The host url of your instance (e.g., `http://localhost:3000`) is passed to the MCP server via the `SOURCEBOT_HOST` url. This allows you to control which repos Sourcebot MCP fetches context from (including private repos). 

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

    Add the following to your [.vscode/mcp.json](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server-to-your-workspace) file:

    ```json
    {
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

    Alternatively, you can install using via [Smithery](https://smithery.ai/server/@sourcebot-dev/sourcebot). For example:

    ```bash
    npx -y @smithery/cli install @sourcebot-dev/sourcebot --client claude
    ```

<br/>

4. Tell your LLM to `use sourcebot` when prompting.

<br/>

For a more detailed guide, checkout [the docs](https://docs.sourcebot.dev/docs/features/mcp-server).


## Available Tools

### search_code

Searches for code that matches the provided search query as a substring by default, or as a regular expression if `useRegex` is true.

<details>
<summary>Parameters</summary>

| Name                  | Required | Description                                                                                                                       |
|:----------------------|:---------|:----------------------------------------------------------------------------------------------------------------------------------|
| `query`               | yes      | The search pattern to match against code contents. Do not escape quotes in your query.                                            |
| `useRegex`            | no       | Whether to use regular expression matching. When false, substring matching is used (default: false).                              |
| `filterByRepos`       | no       | Scope the search to specific repositories.                                                                                        |
| `filterByLanguages`   | no       | Scope the search to specific languages.                                                                                           |
| `filterByFilepaths`   | no       | Scope the search to specific filepaths.                                                                                           |
| `caseSensitive`       | no       | Whether the search should be case sensitive (default: false).                                                                     |
| `includeCodeSnippets` | no       | Whether to include code snippets in the response (default: false).                                                                |
| `ref`                 | no       | Commit SHA, branch or tag name to search on. If not provided, defaults to the default branch.                                     |
| `maxTokens`           | no       | The maximum number of tokens to return (default: 10000). Higher values provide more context but consume more tokens.              |
</details>


### list_repos

Lists repositories indexed by Sourcebot with optional filtering and pagination.

<details>
<summary>Parameters</summary>

| Name        | Required | Description                                                                     |
|:------------|:---------|:--------------------------------------------------------------------------------|
| `query`     | no       | Filter repositories by name (case-insensitive).                                 |
| `page`      | no       | Page number for pagination (min 1, default: 1).                                 |
| `perPage`   | no       | Results per page for pagination (min 1, max 100, default: 30).                  |
| `sort`      | no       | Sort repositories by 'name' or 'pushed' (most recent commit). Default: 'name'. |
| `direction` | no       | Sort direction: 'asc' or 'desc' (default: 'asc').                               |

</details>

### read_file

Reads the source code for a given file.

<details>
<summary>Parameters</summary>

| Name   | Required | Description                                                                                                    |
|:-------|:---------|:---------------------------------------------------------------------------------------------------------------|
| `repo` | yes      | The repository name.                                                                                           |
| `path` | yes      | The path to the file.                                                                                          |
| `ref`  | no       | Commit SHA, branch or tag name to fetch the source code for. If not provided, uses the default branch.         |
</details>

### list_commits

Get a list of commits for a given repository.

<details>
<summary>Parameters</summary>

| Name      | Required | Description                                                                                                                           |
|:----------|:---------|:--------------------------------------------------------------------------------------------------------------------------------------|
| `repo`    | yes      | The name of the repository to list commits for.                                                                                       |
| `query`   | no       | Search query to filter commits by message content (case-insensitive).                                                                 |
| `since`   | no       | Show commits more recent than this date. Supports ISO 8601 (e.g., '2024-01-01') or relative formats (e.g., '30 days ago').            |
| `until`   | no       | Show commits older than this date. Supports ISO 8601 (e.g., '2024-12-31') or relative formats (e.g., 'yesterday').                    |
| `author`  | no       | Filter commits by author name or email (case-insensitive).                                                                            |
| `ref`     | no       | Commit SHA, branch or tag name to list commits of. If not provided, uses the default branch.                                          |
| `page`    | no       | Page number for pagination (min 1, default: 1).                                                                                       |
| `perPage` | no       | Results per page for pagination (min 1, max 100, default: 50).                                                                        |

</details>

### list_language_models

Lists the available language models configured on the Sourcebot instance. Use this to discover which models can be specified when calling `ask_codebase`.

<details>
<summary>Parameters</summary>

This tool takes no parameters.

</details>

### ask_codebase

Ask a natural language question about the codebase. This tool uses an AI agent to autonomously search code, read files, and find symbol references/definitions to answer your question. Returns a detailed answer in markdown format with code references, plus a link to view the full research session in the Sourcebot web UI.

<details>
<summary>Parameters</summary>

| Name            | Required | Description                                                                                                                                    |
|:----------------|:---------|:-----------------------------------------------------------------------------------------------------------------------------------------------|
| `query`         | yes      | The query to ask about the codebase.                                                                                                           |
| `repos`         | no       | The repositories that are accessible to the agent during the chat. If not provided, all repositories are accessible.                           |
| `languageModel` | no       | The language model to use for answering the question. Object with `provider` and `model`. If not provided, defaults to the first model in the config. Use `list_language_models` to see available options. |

</details>


## Supported Code Hosts
Sourcebot supports the following code hosts:
- [GitHub](https://docs.sourcebot.dev/docs/connections/github)
- [GitLab](https://docs.sourcebot.dev/docs/connections/gitlab)
- [Bitbucket Cloud](https://docs.sourcebot.dev/docs/connections/bitbucket-cloud)
- [Bitbucket Data Center](https://docs.sourcebot.dev/docs/connections/bitbucket-data-center)
- [Gitea](https://docs.sourcebot.dev/docs/connections/gitea)
- [Gerrit](https://docs.sourcebot.dev/docs/connections/gerrit)

| Don't see your code host? Open a [feature request](https://github.com/sourcebot-dev/sourcebot/issues/new?template=feature_request.md).

## Future Work

### Semantic Search

Currently, Sourcebot only supports regex-based code search (powered by [zoekt](https://github.com/sourcegraph/zoekt) under the hood). It is great for scenarios when the agent is searching for is something that is super precise and well-represented in the source code (e.g., a specific function name, a error string, etc.). It is not-so-great for _fuzzy_ searches where the objective is to find some loosely defined _category_ or _concept_ in the code (e.g., find code that verifies JWT tokens). The LLM can approximate this by crafting regex searches that attempt to capture a concept (e.g., it might try a query like `"jwt|token|(verify|validate).*(jwt|token)"`), but often yields sub-optimal search results that aren't related. Tools like Cursor solve this with [embedding models](https://docs.cursor.com/context/codebase-indexing) to capture the semantic meaning of code, allowing for LLMs to search using natural language. We would like to extend Sourcebot to support semantic search and expose this capability over MCP as a tool (e.g., `semantic_search_code` tool). [GitHub Discussion](https://github.com/sourcebot-dev/sourcebot/discussions/297)
