# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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