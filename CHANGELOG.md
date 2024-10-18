# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added a toast notification when a new Sourcebot version is available ([#44](https://github.com/sourcebot-dev/sourcebot/pull/44))

## [2.0.1] - 2024-10-17

### Added

- Added support for specifying urls for the `--configPath` option in the backend.

## [2.0.0] - 2024-10-17

### Added

- [**Breaking Change**] Added index schema v2. This new schema brings many quality of life features like clearer syntax, ability to specify individual `repos`, `projects`, `groups`, and `orgs`, and the ability to easily `exclude` repositories.
- Added a `SOURCEBOT_VERSION` build argument to the Docker image. ([#41](https://github.com/sourcebot-dev/sourcebot/pull/41))
- Added the `sourcebot_version` property to all PostHog events for versioned telemetry. ([#41](https://github.com/sourcebot-dev/sourcebot/pull/41)

## [1.0.3] - 2024-10-15

### Fixed

- Fixed issue with unicode characters not being displayed correctly ([#38](https://github.com/sourcebot-dev/sourcebot/pull/38))

## [1.0.2] - 2024-10-09

### Fixed

- Fixed issue with filtering by gitlab groups ([#36](https://github.com/sourcebot-dev/sourcebot/issues/36))


## [1.0.1] - 2024-10-03

### Added

- Added `GITLAB_HOSTNAME` and `GITHUB_HOSTNAME` environment variables to allow overriding the default hostnames for GitLab and GitHub.

## [1.0.0] - 2024-10-01

### Added

- Initial release
