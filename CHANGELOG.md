# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.6.1] - 2024-12-09

### Added

- Added config option `settings.maxFileSize` to control the maximum file size zoekt will index. ([#118](https://github.com/sourcebot-dev/sourcebot/pull/118))

### Fixed
 
- Fixed syntax highlighting for zoekt query language. ([#115](https://github.com/sourcebot-dev/sourcebot/pull/115))
- Fixed issue with Gerrit repo fetching not paginating. ([#114](https://github.com/sourcebot-dev/sourcebot/pull/114))
- Fixed visual issues with filter panel. ([#105](https://github.com/sourcebot-dev/sourcebot/pull/105))

## [2.6.0] - 2024-12-02

### Added

- Gerrit support. ([#104](https://github.com/sourcebot-dev/sourcebot/pull/104))

## [2.5.4] - 2024-11-29

### Added

- Added search history to the search bar. ([#99](https://github.com/sourcebot-dev/sourcebot/pull/99))

## [2.5.3] - 2024-11-28

### Added

- Added symbol suggestions as suggestion type. ([#98](https://github.com/sourcebot-dev/sourcebot/pull/98))

## [2.5.2] - 2024-11-27

### Fixed

- Fixed issue where incorrect repository icons were shown occasionally in the filter panel. ([#95](https://github.com/sourcebot-dev/sourcebot/issues/95))
- Fixed homepage links not resolving correctly when DOMAIN_SUB_PATH is set. ([#96](https://github.com/sourcebot-dev/sourcebot/issues/96))

## [2.5.1] - 2024-11-26

### Added

- Added file suggestions as a suggestion type. ([#88](https://github.com/sourcebot-dev/sourcebot/pull/88))
- Added icon and link support for self-hosted repositories. ([#93](https://github.com/sourcebot-dev/sourcebot/pull/93))

### Changed

- Changed how PostHog telemetry key is passed into the docker image. ([#92](https://github.com/sourcebot-dev/sourcebot/pull/92))

## [2.5.0] - 2024-11-22

### Added

- Added search suggestions to the search bar. ([#85](https://github.com/sourcebot-dev/sourcebot/pull/85))

## [2.4.4] - 2024-11-20

### Added

- Added `DOMAIN_SUB_PATH` environment variable to allow overriding the default domain subpath. ([#74](https://github.com/sourcebot-dev/sourcebot/pull/74))
- Added option `all` to the GitLab index schema, allowing for indexing all projects in a self-hosted GitLab instance. ([#84](https://github.com/sourcebot-dev/sourcebot/pull/84)) 

## [2.4.3] - 2024-11-18

### Changed

- Bumped NodeJS version to v20. ([#78](https://github.com/sourcebot-dev/sourcebot/pull/78)) 

## [2.4.2] - 2024-11-14

### Added

- Added support for syntax highlighting in the search bar. ([#66](https://github.com/sourcebot-dev/sourcebot/pull/66))

### Changed

- Changed the `exclude.repo` property to support glob patterns. ([#70](https://github.com/sourcebot-dev/sourcebot/pull/70))

### Fixed

- Fixed issue with indexing failing for empty repositories. ([#73](https://github.com/sourcebot-dev/sourcebot/pull/73))
- Fixed typos in schema. ([#71](https://github.com/sourcebot-dev/sourcebot/pull/71))

## [2.4.1] - 2024-11-11

### Added

- Added additional telemetry events. ([#63](https://github.com/sourcebot-dev/sourcebot/pull/63))

## [2.4.0] - 2024-11-06

### Added

- Added support for indexing and searching repositories across multiple revisions (tag or branch). ([#58](https://github.com/sourcebot-dev/sourcebot/pull/58))

## [2.3.0] - 2024-11-01

### Added

- Local directory indexing support. ([#56](https://github.com/sourcebot-dev/sourcebot/pull/56))

## [2.2.0] - 2024-10-30

### Added

- Added filtering panel for filtering results by repository and by language. ([#48](https://github.com/sourcebot-dev/sourcebot/pull/48))

### Fixed

- Fixed issue with GitLab sub-projects not being included recursively. ([#54](https://github.com/sourcebot-dev/sourcebot/pull/54))
- Fixed slow rendering performance when rendering a large number of results. ([#52](https://github.com/sourcebot-dev/sourcebot/pull/52))
- Fixed issue with either `star_count` or `fork_count` not being included in the GitLab api response. ([#55](https://github.com/sourcebot-dev/sourcebot/issues/55))

## [2.1.1] - 2024-10-25

### Fixed

- Fixed issue with GitLab projects that are not owned but still visible by the provided `token` _not_ being synchronized. ([#51](https://github.com/sourcebot-dev/sourcebot/pull/51))

## [2.1.0] - 2024-10-22

### Added

- Gitea support ([#45](https://github.com/sourcebot-dev/sourcebot/pull/45))

## [2.0.2] - 2024-10-18

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
