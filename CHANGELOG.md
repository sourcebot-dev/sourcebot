# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Add search context to ask sourcebot context selector. [#397](https://github.com/sourcebot-dev/sourcebot/pull/397)
- Add ability to include/exclude connection in search context. [#399](https://github.com/sourcebot-dev/sourcebot/pull/399)
- Search context refactor to search scope and demo card UI changes. [#405](https://github.com/sourcebot-dev/sourcebot/pull/405)

### Fixed
- Fixed multiple writes race condition on config file watcher. [#398](https://github.com/sourcebot-dev/sourcebot/pull/398)

### Changed
- Bumped AI SDK and associated packages version. [#404](https://github.com/sourcebot-dev/sourcebot/pull/404)
- Bumped form-data package version. [#407](https://github.com/sourcebot-dev/sourcebot/pull/407)
- Bumped next version. [#406](https://github.com/sourcebot-dev/sourcebot/pull/406)

## [4.6.0] - 2025-07-25

### Added
- Introducing Ask Sourcebot - ask natural langauge about your codebase. Get back comprehensive Markdown responses with inline citations back to the code. Bring your own LLM api key. [#392](https://github.com/sourcebot-dev/sourcebot/pull/392) 

### Fixed 
- Fixed onboarding infinite loop when GCP IAP Auth is enabled. [#381](https://github.com/sourcebot-dev/sourcebot/pull/381)

## [4.5.3] - 2025-07-20

### Changed
- Relicense core to FSL-1.1-ALv2. [#388](https://github.com/sourcebot-dev/sourcebot/pull/388)

### Added
- Added `GITLAB_CLIENT_QUERY_TIMEOUT_SECONDS` env var to configure the GitLab client's query timeout. [#390](https://github.com/sourcebot-dev/sourcebot/pull/390)

## [4.5.2] - 2025-07-19

### Changed
- Fixed typos in UI, docs, code [#369](https://github.com/sourcebot-dev/sourcebot/pull/369)
- Add anonymous access option to core and deprecate the `enablePublicAccess` config setting. [#385](https://github.com/sourcebot-dev/sourcebot/pull/385)

## [4.5.1] - 2025-07-14

### Changed
- Revamped onboarding experience. [#376](https://github.com/sourcebot-dev/sourcebot/pull/376)

### Fixed
- Fixed issue with external source code links being broken for paths with spaces. [#364](https://github.com/sourcebot-dev/sourcebot/pull/364)
- Makes base retry indexing configuration configurable and move from a default of `5s` to `60s`. [#377](https://github.com/sourcebot-dev/sourcebot/pull/377)
- Fixed issue where files would sometimes never load in the code browser. [#365](https://github.com/sourcebot-dev/sourcebot/pull/365)

## [4.5.0] - 2025-06-21

### Added
- Added code nav and syntax highlighting for TCL. [#362](https://github.com/sourcebot-dev/sourcebot/pull/362)
- Added analytics dashboard. [#358](https://github.com/sourcebot-dev/sourcebot/pull/358)

### Fixed
- Fixed issue where invites appeared to be created successfully, but were not actually being created in the database. [#359](https://github.com/sourcebot-dev/sourcebot/pull/359)

### Changed
- Audit logging is now enabled by default. [#358](https://github.com/sourcebot-dev/sourcebot/pull/358)

## [4.4.0] - 2025-06-18

### Added
- Added audit logging. [#355](https://github.com/sourcebot-dev/sourcebot/pull/355)
<!-- @NOTE: this release includes a API change that affects the MCP package (@sourcebot/mcp). On release, bump the MCP package's version and delete this message. -->

### Fixed
- Delete account join request when redeeming an invite. [#352](https://github.com/sourcebot-dev/sourcebot/pull/352)
- Fix issue where a repository would not be included in a search context if the context was created before the repository. [#354](https://github.com/sourcebot-dev/sourcebot/pull/354)

### Changed
- Changed search api (and all apis that depend on it) to return raw source code instead of base64 encoded string. ([356](https://github.com/sourcebot-dev/sourcebot/pull/356)).


## [4.3.0] - 2025-06-11

### Added
- Changed repository link in search to file tree + move external link to code host logo. [#340](https://github.com/sourcebot-dev/sourcebot/pull/340)
- Added a basic file search dialog when browsing a repository. [#341](https://github.com/sourcebot-dev/sourcebot/pull/341)

### Fixed
- Text highlighting clarity. [#342](https://github.com/sourcebot-dev/sourcebot/pull/342)
- Fixed repo list column header styling. [#344](https://github.com/sourcebot-dev/sourcebot/pull/344)
- Clean up successful and failed jobs in Redis queues. [#343](https://github.com/sourcebot-dev/sourcebot/pull/343)
- Fixed issue with files occasionally not loading after moving the cursor rapidly over the file browser. [#346](https://github.com/sourcebot-dev/sourcebot/pull/346)

## [4.2.0] - 2025-06-09

### Added
- Added seperate page for signup. [#311](https://github.com/sourcebot-dev/sourcebot/pull/331)
- Fix repo images in authed instance case and add manifest json. [#332](https://github.com/sourcebot-dev/sourcebot/pull/332)
- Added encryption logic for license keys. [#335](https://github.com/sourcebot-dev/sourcebot/pull/335)
- Added hover tooltip for long repo names in filter panel. [#338](https://github.com/sourcebot-dev/sourcebot/pull/338)
- Added repo shard validation on startup. [#339](https://github.com/sourcebot-dev/sourcebot/pull/339)
- Added support for a file explorer when browsing files. [#336](https://github.com/sourcebot-dev/sourcebot/pull/336)

## [4.1.1] - 2025-06-03

### Added
- Added copy button for filenames. [#328](https://github.com/sourcebot-dev/sourcebot/pull/328)
- Added development docker compose file. [#328](https://github.com/sourcebot-dev/sourcebot/pull/328)
- Added keyboard shortcuts for find all refs / go to def. [#329](https://github.com/sourcebot-dev/sourcebot/pull/329)
- Added GCP IAP JIT provisioning. [#330](https://github.com/sourcebot-dev/sourcebot/pull/330)

### Fixed
- Fixed issue with the symbol hover popover clipping at the top of the page. [#326](https://github.com/sourcebot-dev/sourcebot/pull/326)
- Fixed slow rendering issue with large reference/definition lists. [#327](https://github.com/sourcebot-dev/sourcebot/pull/327)

## [4.1.0] - 2025-06-02

### Added
- Added structured logging support. [#323](https://github.com/sourcebot-dev/sourcebot/pull/323)

### Fixed
- Fixed issue where new oauth providers weren't being display in the login page. [commit](https://github.com/sourcebot-dev/sourcebot/commit/a2e06266dbe5e5ad4c2c3f730c73d64edecedcf7)
- Fixed client side "mark decorations may not be empty" error when viewing certain files. [#325](https://github.com/sourcebot-dev/sourcebot/pull/325)
- Fixed issue where the symbol hover popover would not appear for large source files. [#325](https://github.com/sourcebot-dev/sourcebot/pull/325)


## [4.0.1] - 2025-05-28

### Fixed
- Fixed issue with how entitlements are resolved for cloud. [#319](https://github.com/sourcebot-dev/sourcebot/pull/319)

## [4.0.0] - 2025-05-28

Sourcebot V4 introduces authentication, performance improvements and code navigation. Checkout the [migration guide](https://docs.sourcebot.dev/docs/upgrade/v3-to-v4-guide) for information on upgrading your instance to v4.

### Changed
- [**Breaking Change**] Authentication is now required by default. Notes:
  - When setting up your instance, email / password login will be the default authentication provider.
  - The first user that logs into the instance is given the `owner` role. ([docs](https://docs.sourcebot.dev/docs/configuration/auth/roles-and-permissions)).
  - Subsequent users can request to join the instance. The `owner` can approve / deny requests to join the instance via `Settings` > `Members` > `Pending Requests`.
  - If a user is approved to join the instance, they are given the `member` role.
  - Additional login providers, including email links and SSO, can be configured with additional environment variables. ([docs](https://docs.sourcebot.dev/docs/configuration/auth/overview)).
- Clicking on a search result now takes you to the `/browse` view. Files can still be previewed by clicking the "Preview" button or holding `Cmd` / `Ctrl` when clicking on a search result. [#315](https://github.com/sourcebot-dev/sourcebot/pull/315)

### Added
- [Sourcebot EE] Added search-based code navigation, allowing you to jump between symbol definition and references when viewing source files. [Read the documentation](https://docs.sourcebot.dev/docs/features/code-navigation). [#315](https://github.com/sourcebot-dev/sourcebot/pull/315)
- Added collapsible filter panel. [#315](https://github.com/sourcebot-dev/sourcebot/pull/315)
- Added Sourcebot API key management for external clients. [#311](https://github.com/sourcebot-dev/sourcebot/pull/311)

### Fixed
- Improved scroll performance for large numbers of search results. [#315](https://github.com/sourcebot-dev/sourcebot/pull/315)

## [3.2.1] - 2025-05-15

### Added
- Added support for indexing generic git hosts given a remote clone url or local path. [#307](https://github.com/sourcebot-dev/sourcebot/pull/307)

## [3.2.0] - 2025-05-12

### Added
- Added AI code review agent [#298](https://github.com/sourcebot-dev/sourcebot/pull/298). Checkout the [docs](https://docs.sourcebot.dev/docs/features/agents/review-agent) for more information.

### Fixed
- Fixed issue with repos appearing in the carousel when they fail indexing for the first time. [#305](https://github.com/sourcebot-dev/sourcebot/pull/305)
- Align gitea clone_url with gitea host url [#303](https://github.com/sourcebot-dev/sourcebot/pull/303)

## [3.1.4] - 2025-05-10

### Fixed
- Added better error handling to git operations

## [3.1.3] - 2025-05-07

### Fixed
- Fixes bug with repos not being visible in the homepage carousel when re-indexing. [#294](https://github.com/sourcebot-dev/sourcebot/pull/294)

### Added
- Added special `*` value for `rev:` to allow searching across all branches. [#281](https://github.com/sourcebot-dev/sourcebot/pull/281)
- Added the Sourcebot Model Context Protocol (MCP) server in [packages/mcp](./packages/mcp/README.md) to allow LLMs to interface with Sourcebot. Checkout the npm package [here](https://www.npmjs.com/package/@sourcebot/mcp). [#292](https://github.com/sourcebot-dev/sourcebot/pull/292)

## [3.1.2] - 2025-04-30

### Added
- Added `exclude.readOnly` and `exclude.hidden` options to Gerrit connection config. [#280](https://github.com/sourcebot-dev/sourcebot/pull/280)

### Fixes
- Fixes regression introduced in v3.1.0 that causes auth errors with GitHub. [#288](https://github.com/sourcebot-dev/sourcebot/pull/288)

## [3.1.1] - 2025-04-28

### Changed
- Changed the filter panel to embed the filter selection state in the query params. [#276](https://github.com/sourcebot-dev/sourcebot/pull/276)

## [3.1.0] - 2025-04-25

### Added
- [Sourcebot EE] Added search contexts, user-defined groupings of repositories that help focus searches on specific areas of a codebase. [#273](https://github.com/sourcebot-dev/sourcebot/pull/273)
- Added support for Bitbucket Cloud and Bitbucket Data Center connections. [#275](https://github.com/sourcebot-dev/sourcebot/pull/275)


## [3.0.4] - 2025-04-12

### Fixes
- Fix issue with gerrit gitiles web urls not being correctly formatted

## [3.0.3] - 2025-04-10

### Fixes
- Prevent database in container from being initialized and started if we're using an external database [#267](https://github.com/sourcebot-dev/sourcebot/pull/267)

### Added
- Add additional logging for repo and connection syncing, and display proper names instead of ids

## [3.0.2] - 2025-04-04

### Fixes
- Change connection manager upsert timeout to 5 minutes
- Fix issue with repo display names being poorly formatted, especially for gerrit. ([#259](https://github.com/sourcebot-dev/sourcebot/pull/259))

### Added
- Added config setting `resyncConnectionIntervalMs` to control how often a connection should be re-synced. ([#260](https://github.com/sourcebot-dev/sourcebot/pull/260))

## [3.0.1] - 2025-04-01

### Fixes
- Fix issue with match highlighting not appearing when first clicking on a search result. ([#255](https://github.com/sourcebot-dev/sourcebot/issues/255))

## [3.0.0] - 2025-04-01

Sourcebot v3 is here and brings a number of structural changes to the tool's foundation, including a SQL database, parallelized indexing, authentication support, multitenancy, and more. Checkout the [migration guide](https://docs.sourcebot.dev/docs/upgrade/v2-to-v3-guide) for information on upgrading your instance to v3.

### Changed
- [**Breaking Change**] Changed the config schema such that connection objects are specified in the `connection` map, instead of the `repos` array. [See migration guide](https://docs.sourcebot.dev/docs/upgrade/v2-to-v3-guide).
- Updated the tool's color-palette in dark mode.

### Added
- Added parallelized repo indexing and connection syncing via Redis & BullMQ. See the [architecture overview](https://docs.sourcebot.dev/docs/overview#architecture).
- Added repo indexing progress indicators in the navbar.
- Added authentication support via OAuth or email/password. For instructions on enabling, see [this doc](https://docs.sourcebot.dev/docs/configuration/auth/overview).
- Added the following UI for managing your deployment when **[auth is enabled](https://docs.sourcebot.dev/docs/configuration/auth/overview)**:
  - connection management: create and manage your JSON configs via a integrated web-editor.
  - secrets: import personal access tokens (PAT) into Sourcebot (AES-256 encrypted). Reference secrets in your connection config by name.
  - team & invite management: invite users to your instance to give them access. Configure team [roles & permissions](https://docs.sourcebot.dev/docs/configuration/auth/roles-and-permissions).
- Added multi-tenancy support. See [this doc](https://docs.sourcebot.dev/self-hosting/more/tenancy).

### Removed
- [**Breaking Change**] Removed `db.json` in favour of a Postgres database for transactional workloads. See the [architecture overview](https://docs.sourcebot.dev/self-hosting/overview#architecture).
- [**Breaking Change**] Removed local folder & arbitrary .git repo support. If your deployment depended on these features, please [open a discussion](https://github.com/sourcebot-dev/sourcebot/discussions/categories/support) and let us know.
- [**Breaking Chnage**] Removed ability to specify a `token` as a string literal from the schema.
- [**Breaking Change**] Removed support for `DOMAIN_SUB_PATH` configuration.


## [2.8.4] - 2025-03-14

### Fixed

- Fixed bug where Sourcebot Cloud card was shown to self-hosted users

## [2.8.3] - 2025-03-13

### Fixed

- Made syntax reference guide keyboard shortcut hints clickable. ([#229](https://github.com/sourcebot-dev/sourcebot/pull/229))

## [2.8.2] - 2025-02-20

### Fixed

- Remove `repo_synced` telemetry event.

## [2.8.1] - 2025-01-28

### Added

- Added `maxTrigramCount` to the config to control the maximum allowable of trigrams per document.

### Fixed

- Fixed issue with version upgrade toast not appearing without a hard refresh. ([#179](https://github.com/sourcebot-dev/sourcebot/pull/179))

## [2.8.0] - 2025-01-17

### Added

- Added a syntax reference guide. The guide can be opened using the hotkey "Cmd + /" ("Ctrl + /" on Windows). ([#169](https://github.com/sourcebot-dev/sourcebot/pull/169))

## [2.7.1] - 2025-01-15

### Fixed

- Fixed issue where we crash on startup if the install / upgrade PostHog event fails to send. ([#159](https://github.com/sourcebot-dev/sourcebot/pull/159))
- Fixed issue with broken file links. ([#161](https://github.com/sourcebot-dev/sourcebot/pull/161))

## [2.7.0] - 2025-01-10

### Added

- Added support for creating share links to snippets of code. ([#149](https://github.com/sourcebot-dev/sourcebot/pull/149))
- Added support for indexing raw remote git repository. ([#152](https://github.com/sourcebot-dev/sourcebot/pull/152))

## [2.6.3] - 2024-12-18

### Added

- Added config option `settings.reindexInterval` and `settings.resyncInterval` to control how often the index should be re-indexed and re-synced. ([#134](https://github.com/sourcebot-dev/sourcebot/pull/134))
- Added `exclude.size` to the GitHub config to allow excluding repositories by size. ([#137](https://github.com/sourcebot-dev/sourcebot/pull/137))

### Fixed

- Fixed issue where config synchronization was failing entirely when a single api call fails. ([#142](https://github.com/sourcebot-dev/sourcebot/pull/142))
- Fixed 'directory not found' error in certain scenarios when deleting a repository. ([#136](https://github.com/sourcebot-dev/sourcebot/pull/136))

## [2.6.2] - 2024-12-13

### Added

- Added config support for filtering GitLab & GitHub repositories by topic. ([#121](https://github.com/sourcebot-dev/sourcebot/pull/121))
- Added additional language syntax support. ([#125](https://github.com/sourcebot-dev/sourcebot/pull/125))
- Added additional language icon support. ([#129](https://github.com/sourcebot-dev/sourcebot/pull/129))

### Changed

- Made language suggestions case insensitive. ([#124](https://github.com/sourcebot-dev/sourcebot/pull/124))
- Stale repositories are now automatically deleted from the index. This can be configured via `settings.autoDeleteStaleRepos` in the config. ([#128](https://github.com/sourcebot-dev/sourcebot/pull/128))

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
