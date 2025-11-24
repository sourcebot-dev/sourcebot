# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added comprehensive relative date support for all temporal parameters (e.g., "30 days ago", "last week", "yesterday")
- Added `search_commits` tool to search commits by actual commit time with full temporal filtering. Accepts both numeric database IDs (e.g., 123) and string repository names (e.g., "github.com/owner/repo") for the `repoId` parameter, allowing direct use of repository names from `list_repos` output
- Added `since`/`until` parameters to `search_code` (filters by index time - when Sourcebot indexed the repo)
- Added `gitRevision` parameter to `search_code`
- Added `activeAfter`/`activeBefore` parameters to `list_repos` (filters by index time - when Sourcebot indexed the repo)
- Added date range validation to prevent invalid date ranges (since > until)
- Added 30-second timeout for git operations to handle large repositories
- Added enhanced error messages for git operations (timeout, repository not found, invalid git repository, ambiguous arguments)
- Added clarification that repositories must be cloned on Sourcebot server disk for `search_commits` to work
- Added comprehensive temporal parameter documentation to README with clear distinction between index time and commit time filtering
- Added comprehensive unit tests for date parsing utilities (90+ test cases)
- Added unit tests for git commit search functionality with mocking
- Added integration tests for temporal parameter validation
- Added unit tests for repository identifier resolution (both string and number types)

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