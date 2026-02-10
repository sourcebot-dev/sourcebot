# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added `list_tree` tool for listing files/directories in a repository path with depth controls, suitable for both directory listings and repo-tree workflows.

## [1.0.15] - 2026-02-02

### Added
- Added `ask_codebase` tool that can invoke the Ask subagent to explore a set of codebases and return a summarized answer. [#814](https://github.com/sourcebot-dev/sourcebot/pull/814)
- Added `list_language_models` tool to discover available language models configured on the Sourcebot instance. [#814](https://github.com/sourcebot-dev/sourcebot/pull/814)

## [1.0.14] - 2026-01-27

### Changed
- Updated README.

## [1.0.13] - 2026-01-27

### Added
- Added `search_commits` tool to search a repos commit history. [#625](https://github.com/sourcebot-dev/sourcebot/pull/625)
- Added `gitRevision` parameter to the `search_code` tool to allow for searching on different branches. [#625](https://github.com/sourcebot-dev/sourcebot/pull/625)
- Added server side pagination support for `list_commits` and `list_repos`. [#795](https://github.com/sourcebot-dev/sourcebot/pull/795)
- Added `filterByFilepaths` and `useRegex` params to the `search_code` tool. [#795](https://github.com/sourcebot-dev/sourcebot/pull/795)

### Changed
- Renamed `search_commits` tool to `list_commits`. [#795](https://github.com/sourcebot-dev/sourcebot/pull/795)
- Renamed `gitRevision` param to `ref` on `search_code` tool. [#795](https://github.com/sourcebot-dev/sourcebot/pull/795)
- Generally improved tool and tool param descriptions for all tools. [#795](https://github.com/sourcebot-dev/sourcebot/pull/795)

## [1.0.12] - 2026-01-13

### Fixed
- Fixed invalid file and url MCP results for local indexed repos [#718](https://github.com/sourcebot-dev/sourcebot/pull/718)

## [1.0.11] - 2025-12-03

### Changed
- Updated API client to match the latest Sourcebot release. [#652](https://github.com/sourcebot-dev/sourcebot/pull/652)

## [1.0.10] - 2025-11-24

### Changed
- Updated API client to match the latest Sourcebot release. [#555](https://github.com/sourcebot-dev/sourcebot/pull/555)

## [1.0.9] - 2025-11-17

### Added
- Added pagination and filtering to `list_repos` tool to handle large repository lists efficiently and prevent oversized responses that waste token context. [#614](https://github.com/sourcebot-dev/sourcebot/pull/614)

## [1.0.8] - 2025-11-10

### Fixed
- Fixed issue where search results exceeding token limits would be completely discarded instead of returning truncated content. [#604](https://github.com/sourcebot-dev/sourcebot/pull/604)

## [1.0.7] - 2025-10-28

### Changed
- Updated API client to match the latest Sourcebot release. [#555](https://github.com/sourcebot-dev/sourcebot/pull/555)

## [1.0.6] - 2025-09-26

### Fixed
- Fix `linkedConnections is required` schema error.

## [1.0.5] - 2025-09-15

### Changed
- Updated API client to match the latest Sourcebot release. [#356](https://github.com/sourcebot-dev/sourcebot/pull/356)

## [1.0.4] - 2025-08-04

### Fixed
- Fixed issue where console logs were resulting in "unexpected token" errors on the MCP client. [#429](https://github.com/sourcebot-dev/sourcebot/pull/429)

## [1.0.3] - 2025-06-18

### Changed
- Updated API client to match the latest Sourcebot release. [#356](https://github.com/sourcebot-dev/sourcebot/pull/356)

## [1.0.2] - 2025-05-28

### Changed
- Added API key support. [#311](https://github.com/sourcebot-dev/sourcebot/pull/311)

## [1.0.1] - 2025-05-15

### Changed
- Updated API client to match the latest Sourcebot release. [#307](https://github.com/sourcebot-dev/sourcebot/pull/307)

## [1.0.0] - 2025-05-07

### Added
- Initial release
