# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed issue where 403 errors were being raised during a user driven permission sync against a self-hosted code host. [#729](https://github.com/sourcebot-dev/sourcebot/pull/729)
- Fixed "ambiguous argument 'HEAD^{commit}': unknown revision or path not in the working tree" error for blank repositories. [#733](https://github.com/sourcebot-dev/sourcebot/pull/733)

## [4.10.8] - 2026-01-13

### Changed
- Changed the default `/repos` pagination size to 20. [#706](https://github.com/sourcebot-dev/sourcebot/pull/706)
- Changed pull policy in docker compose file to always. [#716](https://github.com/sourcebot-dev/sourcebot/pull/716)
- Added Trigger Sync to /repos dropdown menu [#710](https://github.com/sourcebot-dev/sourcebot/pull/710)

### Fixed
- Add warning logs when local repo index fails to match pattern. [#712](https://github.com/sourcebot-dev/sourcebot/pull/712)
- Fixed issue with text direction issues with special characters in filter panel. [#474](https://github.com/sourcebot-dev/sourcebot/pull/474)
- Fixed issue where folders containing files with non-ASCII characters in their paths would appear duplicated in the file tree.

## [4.10.7] - 2025-12-29

### Fixed
- Fixed auto-suggestion dropdown breaking queries with whitespace in repository names. Repository names containing spaces are now properly wrapped in quotes. [#705](https://github.com/sourcebot-dev/sourcebot/pull/705)

## [4.10.6] - 2025-12-28

### Fixed
- Fixed repository images not loading when anonymous access is disabled. [#703](https://github.com/sourcebot-dev/sourcebot/pull/703)

### Changed
- Enable browser assisted autofill for username and password.[#696](https://github.com/sourcebot-dev/sourcebot/pull/696)

## [4.10.5] - 2025-12-23

### Changed
- Bake Sourcebot version into code rather than relying on build arg. [#680](https://github.com/sourcebot-dev/sourcebot/pull/680)
- Fix issue with `/repos` page pagination. [#689](https://github.com/sourcebot-dev/sourcebot/pull/689)
- Add better logs for gitlab config sync fails. [#692](https://github.com/sourcebot-dev/sourcebot/pull/692)

## [4.10.4] - 2025-12-18

### Fixed
- Fixed issue where parenthesis in query params were not being encoded, resulting in a poor experience when embedding links in Markdown. [#674](https://github.com/sourcebot-dev/sourcebot/pull/674)
- Gitlab clone respects host protocol setting in environment variable. [#676](https://github.com/sourcebot-dev/sourcebot/pull/676)
- Fixed performance issues with `/repos` page. [#677](https://github.com/sourcebot-dev/sourcebot/pull/677)

## [4.10.3] - 2025-12-12

### Fixed
- Fixed review agent so that it works with GHES instances [#611](https://github.com/sourcebot-dev/sourcebot/pull/611)
- Updated next package version to fix CVE-2025-55184 and CVE-2025-55183. [#673](https://github.com/sourcebot-dev/sourcebot/pull/673)

### Added
- Added support for arbitrary user IDs required for OpenShift. [#658](https://github.com/sourcebot-dev/sourcebot/pull/658) 

### Updated
- Improved error messages in file source api. [#665](https://github.com/sourcebot-dev/sourcebot/pull/665)

## [4.10.2] - 2025-12-04

### Fixed
- Fixed issue where the disable telemetry flag was not being respected for web server telemetry. [#657](https://github.com/sourcebot-dev/sourcebot/pull/657)

## [4.10.1] - 2025-12-03

### Added
- Added `ALWAYS_INDEX_FILE_PATTERNS` environment variable to allow specifying a comma seperated list of glob patterns matching file paths that should always be indexed, regardless of size or # of trigrams. [#631](https://github.com/sourcebot-dev/sourcebot/pull/631)
- Added button to explore menu to toggle cross-repository search. [#647](https://github.com/sourcebot-dev/sourcebot/pull/647)
- Added server side telemetry for search metrics. [#652](https://github.com/sourcebot-dev/sourcebot/pull/652)

### Fixed
- Fixed issue where single quotes could not be used in search queries. [#629](https://github.com/sourcebot-dev/sourcebot/pull/629)
- Fixed issue where files with special characters would fail to load. [#636](https://github.com/sourcebot-dev/sourcebot/issues/636)
- Fixed Ask performance issues. [#632](https://github.com/sourcebot-dev/sourcebot/pull/632)
- Fixed regression where creating a new Ask thread when unauthenticated would result in a 404. [#641](https://github.com/sourcebot-dev/sourcebot/pull/641)
- Updated react and next package versions to fix CVE 2025-55182. [#654](https://github.com/sourcebot-dev/sourcebot/pull/654)

### Changed
- Changed the default behaviour for code nav to scope references & definitions search to the current repository. [#647](https://github.com/sourcebot-dev/sourcebot/pull/647)

## [4.10.0] - 2025-11-24

### Added
- Added support for streaming code search results. [#623](https://github.com/sourcebot-dev/sourcebot/pull/623)
- Added buttons to toggle case sensitivity and regex patterns. [#623](https://github.com/sourcebot-dev/sourcebot/pull/623)
- Added counts to members, requets, and invites tabs in the members settings. [#621](https://github.com/sourcebot-dev/sourcebot/pull/621)
- [Sourcebot EE] Add support for Authentik as a identity provider. [#627](https://github.com/sourcebot-dev/sourcebot/pull/627)

### Changed
- Changed the default search behaviour to match patterns as substrings and **not** regular expressions. Regular expressions can be used by toggling the regex button in search bar. [#623](https://github.com/sourcebot-dev/sourcebot/pull/623)
- Renamed `public` query prefix to `visibility`. Allowed values for `visibility` are `public`, `private`, and `any`. [#623](https://github.com/sourcebot-dev/sourcebot/pull/623)
- Changed `archived` query prefix to accept values `yes`, `no`, and `only`. [#623](https://github.com/sourcebot-dev/sourcebot/pull/623)
- Changed `lang` query prefix to be case sensitive. [#623](https://github.com/sourcebot-dev/sourcebot/pull/623)

### Removed
- Removed `case` query prefix. [#623](https://github.com/sourcebot-dev/sourcebot/pull/623)
- Removed `branch` and `b` query prefixes. Please use `rev:` instead. [#623](https://github.com/sourcebot-dev/sourcebot/pull/623)
- Removed `regex` query prefix. [#623](https://github.com/sourcebot-dev/sourcebot/pull/623)

### Fixed
- Fixed spurious infinite loads with explore panel, file tree, and file search command. [#617](https://github.com/sourcebot-dev/sourcebot/pull/617)
- Wipe search context on init if entitlement no longer exists [#618](https://github.com/sourcebot-dev/sourcebot/pull/618)
- Fixed Bitbucket repository exclusions not supporting glob patterns. [#620](https://github.com/sourcebot-dev/sourcebot/pull/620)
- Fixed issue where the repo driven permission syncer was attempting to sync public repositories. [#624](https://github.com/sourcebot-dev/sourcebot/pull/624)
- Fixed issue where worker would not shutdown while a permission sync job (repo or user) was in progress. [#624](https://github.com/sourcebot-dev/sourcebot/pull/624)

## [4.9.2] - 2025-11-13

### Changed
- Bumped the default requested search result count from 5k to 10k after optimization pass. [#615](https://github.com/sourcebot-dev/sourcebot/pull/615)

### Fixed
- Fixed incorrect shutdown of PostHog SDK in the worker. [#609](https://github.com/sourcebot-dev/sourcebot/pull/609)
- Fixed race condition in job schedulers. [#607](https://github.com/sourcebot-dev/sourcebot/pull/607)
- Fixed connection sync jobs getting stuck in pending or in progress after restarting the worker. [#612](https://github.com/sourcebot-dev/sourcebot/pull/612)
- Fixed issue where connections would always sync on startup, regardless if they changed or not. [#613](https://github.com/sourcebot-dev/sourcebot/pull/613)
- Fixed performance bottleneck in search api. Result is a order of magnitutde improvement to average search time according to benchmarks. [#615](https://github.com/sourcebot-dev/sourcebot/pull/615) 

### Added
- Added force resync buttons for connections and repositories. [#610](https://github.com/sourcebot-dev/sourcebot/pull/610)
- Added environment variable to configure default search result count. [#616](https://github.com/sourcebot-dev/sourcebot/pull/616)

## [4.9.1] - 2025-11-07

### Added
- Added support for running Sourcebot as non-root user. [#599](https://github.com/sourcebot-dev/sourcebot/pull/599)

## [4.9.0] - 2025-11-04

### Added
- [Experimental][Sourcebot EE] Added GitLab permission syncing. [#585](https://github.com/sourcebot-dev/sourcebot/pull/585)
- [Sourcebot EE] Added external identity provider config and support for multiple accounts. [#595](https://github.com/sourcebot-dev/sourcebot/pull/595)
- Added ability to configure environment variables from the config. [#597](https://github.com/sourcebot-dev/sourcebot/pull/597)

### Fixed
- [ask sb] Fixed issue where reasoning tokens would appear in `text` content for openai compatible models. [#582](https://github.com/sourcebot-dev/sourcebot/pull/582)
- Fixed issue with GitHub app token tracking and refreshing. [#583](https://github.com/sourcebot-dev/sourcebot/pull/583)
- Fixed "The account is already associated with another user" errors with GitLab oauth provider. [#584](https://github.com/sourcebot-dev/sourcebot/pull/584)
- Fixed error when viewing a generic git connection in `/settings/connections`. [#588](https://github.com/sourcebot-dev/sourcebot/pull/588)
- Fixed issue with an unbounded `Promise.allSettled(...)` when retrieving details from the GitHub API about a large number of repositories (or orgs or users). [#591](https://github.com/sourcebot-dev/sourcebot/pull/591)
- Fixed resource exhaustion (EAGAIN errors) when syncing generic-git-host connections with thousands of repositories. [#593](https://github.com/sourcebot-dev/sourcebot/pull/593)

### Removed
- Removed built-in secret manager. [#592](https://github.com/sourcebot-dev/sourcebot/pull/592)

### Changed
- Changed internal representation of how repo permissions are represented in the database. [#600](https://github.com/sourcebot-dev/sourcebot/pull/600)

## [4.8.1] - 2025-10-29

### Fixed
- Fixed commit and branch hyperlinks not rendering for Gerrit repos. [#581](https://github.com/sourcebot-dev/sourcebot/pull/581)
- Fixed visual bug when a repository does not have a image. [#581](https://github.com/sourcebot-dev/sourcebot/pull/581)
- Fixed issue where the Ask homepage was not scrollable. [#581](https://github.com/sourcebot-dev/sourcebot/pull/581)

## [4.8.0] - 2025-10-28

### Added
- Implement dynamic tab titles for files and folders in browse tab. [#560](https://github.com/sourcebot-dev/sourcebot/pull/560)
- Added support for passing db connection url as seperate `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`, and `DATABASE_ARGS` env vars. [#545](https://github.com/sourcebot-dev/sourcebot/pull/545)
- Added support for GitHub Apps for service auth. [#570](https://github.com/sourcebot-dev/sourcebot/pull/570)
- Added prometheus metrics for repo index manager. [#571](https://github.com/sourcebot-dev/sourcebot/pull/571)
- Added experimental environment variable to disable API key creation for non-admin users. [#577](https://github.com/sourcebot-dev/sourcebot/pull/577)
- [Experimental][Sourcebot EE] Added REST API to get users and delete a user. [#578](https://github.com/sourcebot-dev/sourcebot/pull/578)

### Fixed
- Fixed "dubious ownership" errors when cloning / fetching repos. [#553](https://github.com/sourcebot-dev/sourcebot/pull/553)
- Fixed issue with Ask Sourcebot tutorial re-appearing after restarting the browser. [#563](https://github.com/sourcebot-dev/sourcebot/pull/563)
- Fixed `repoIndexTimeoutMs` not being used for index job timeouts. [#567](https://github.com/sourcebot-dev/sourcebot/pull/567)

### Changed
- Improved search performance for unbounded search queries. [#555](https://github.com/sourcebot-dev/sourcebot/pull/555)
- Improved homepage performance by removing client side polling. [#563](https://github.com/sourcebot-dev/sourcebot/pull/563)
- Changed navbar indexing indicator to only report progress for first time indexing jobs. [#563](https://github.com/sourcebot-dev/sourcebot/pull/563)
- Improved repo indexing job stability and robustness. [#563](https://github.com/sourcebot-dev/sourcebot/pull/563)
- Improved repositories table. [#572](https://github.com/sourcebot-dev/sourcebot/pull/572)
- Improved connections table. [#579](https://github.com/sourcebot-dev/sourcebot/pull/579)

### Removed
- Removed spam "login page loaded" log. [#552](https://github.com/sourcebot-dev/sourcebot/pull/552)
- Removed connections management page. [#563](https://github.com/sourcebot-dev/sourcebot/pull/563)

## [4.7.3] - 2025-09-29

### Fixed
- Manually pass auth token for ado server deployments. [#543](https://github.com/sourcebot-dev/sourcebot/pull/543)

## [4.7.2] - 2025-09-22

### Fixed
- Fix support email. [#529](https://github.com/sourcebot-dev/sourcebot/pull/529)

### Added
- [Experimental][Sourcebot EE] Added permission syncing repository Access Control Lists (ACLs) between Sourcebot and GitHub. [#508](https://github.com/sourcebot-dev/sourcebot/pull/508)

### Changed
- Improved repository query performance by adding db indices. [#526](https://github.com/sourcebot-dev/sourcebot/pull/526)
- Improved repository query performance by removing JOIN on `Connection` table. [#527](https://github.com/sourcebot-dev/sourcebot/pull/527)
- Changed repo carousel and repo list links to redirect to the file browser. [#528](https://github.com/sourcebot-dev/sourcebot/pull/528)
- Changed file headers, files/directories in file tree, and reference list buttons into links. [#532](https://github.com/sourcebot-dev/sourcebot/pull/532)

## [4.7.1] - 2025-09-19

### Fixed
- Fixed sourcebot not pulling github forked repos [#499](https://github.com/sourcebot-dev/sourcebot/pull/499)
- Fixed azure devop cloud pat issue [#524](https://github.com/sourcebot-dev/sourcebot/pull/524)

## [4.7.0] - 2025-09-17

### Added
- Added fallback to default the Node.JS AWS SDK's `fromNodeProviderChain` when no credentials are provided for a bedrock config. [#513](https://github.com/sourcebot-dev/sourcebot/pull/513)
- Added support for Azure Devops support. [#514](https://github.com/sourcebot-dev/sourcebot/pull/514)

### Fixed
- Fixed "At least one project, user, or group must be specified" for GitLab configs with `all` in web configurator. [#512](https://github.com/sourcebot-dev/sourcebot/pull/512)
- Fixed zoekt indexing failing with pipe in branch/tag names [#506](https://github.com/sourcebot-dev/sourcebot/pull/506)
- Removed deprecated connection creation/edit UI [#515](https://github.com/sourcebot-dev/sourcebot/pull/515)

## [4.6.8] - 2025-09-15

### Fixed
- Fixed Bitbucket Cloud pagination not working beyond first page. [#295](https://github.com/sourcebot-dev/sourcebot/issues/295)
- Fixed search bar line wrapping. [#501](https://github.com/sourcebot-dev/sourcebot/pull/501)
- Fixed carousel perf issues. [#507](https://github.com/sourcebot-dev/sourcebot/pull/507)

## [4.6.7] - 2025-09-08

### Added
- Added `exclude.userOwnedProjects` setting to GitLab configs. [#498](https://github.com/sourcebot-dev/sourcebot/pull/498)

### Fixed
- Fixed "couldn't find remote ref HEAD" errors when re-indexing certain repositories. [#497](https://github.com/sourcebot-dev/sourcebot/pull/497)

### Changed
- Disable page scroll when using arrow keys on search suggestions box. [#493](https://github.com/sourcebot-dev/sourcebot/pull/493)

## [4.6.6] - 2025-09-04

### Added
- Added support for specifying query params for openai compatible language models. [#490](https://github.com/sourcebot-dev/sourcebot/pull/490)

### Fixed
- Fix issue where zoekt was failing to index repositories due to `HEAD` pointing to a branch that does not exist. [#488](https://github.com/sourcebot-dev/sourcebot/pull/488)

## [4.6.5] - 2025-09-02

### Fixed
- Remove setting `remote.origin.url` for remote git repositories. [#483](https://github.com/sourcebot-dev/sourcebot/pull/483)
- Fix error when navigating to paths with percentage symbols. [#485](https://github.com/sourcebot-dev/sourcebot/pull/485)

### Changed
- Updated NextJS to version 15. [#477](https://github.com/sourcebot-dev/sourcebot/pull/477)
- Add `sessionToken` as optional Bedrock configuration parameter. [#478](https://github.com/sourcebot-dev/sourcebot/pull/478)

## [4.6.4] - 2025-08-11

### Added
- Added multi-branch indexing support for Gerrit. [#433](https://github.com/sourcebot-dev/sourcebot/pull/433)
- [ask sb] Added `reasoningEffort` option to OpenAI provider. [#446](https://github.com/sourcebot-dev/sourcebot/pull/446)
- [ask db] Added `headers` option to all providers. [#449](https://github.com/sourcebot-dev/sourcebot/pull/449)

### Fixed
- Removed prefix from structured log output. [#443](https://github.com/sourcebot-dev/sourcebot/pull/443)
- [ask sb] Fixed long generation times for first message in a chat thread. [#447](https://github.com/sourcebot-dev/sourcebot/pull/447)

### Changed
- Bumped AI SDK and associated packages version. [#444](https://github.com/sourcebot-dev/sourcebot/pull/444)

## [4.6.3] - 2025-08-04

### Fixed
- Fixed issue where `users` specified in a GitHub config were not getting picked up when a `token` is also specified. [#428](https://github.com/sourcebot-dev/sourcebot/pull/428)

### Added
- [ask sb] Added OpenAI Compatible Language Provider. [#424](https://github.com/sourcebot-dev/sourcebot/pull/424)

## [4.6.2] - 2025-07-31

### Changed
- Bumped AI SDK and associated packages version. [#417](https://github.com/sourcebot-dev/sourcebot/pull/417)

### Fixed
- [ask sb] Fixed "413 content too large" error when starting a new chat with many repos selected. [#416](https://github.com/sourcebot-dev/sourcebot/pull/416)

### Added
- [ask sb] PostHog telemetry for chat thread creation. [#418](https://github.com/sourcebot-dev/sourcebot/pull/418)

## [4.6.1] - 2025-07-29

### Added
- Add search context to ask sourcebot context selector. [#397](https://github.com/sourcebot-dev/sourcebot/pull/397)
- Add ability to include/exclude connection in search context. [#399](https://github.com/sourcebot-dev/sourcebot/pull/399)
- Search context refactor to search scope and demo card UI changes. [#405](https://github.com/sourcebot-dev/sourcebot/pull/405)
- Add GitHub star toast. [#409](https://github.com/sourcebot-dev/sourcebot/pull/409)
- Added a onboarding modal when first visiting the homepage when `ask` mode is selected. [#408](https://github.com/sourcebot-dev/sourcebot/pull/408)
- [ask sb] Added `searchReposTool` and `listAllReposTool`. [#400](https://github.com/sourcebot-dev/sourcebot/pull/400)

### Fixed
- Fixed multiple writes race condition on config file watcher. [#398](https://github.com/sourcebot-dev/sourcebot/pull/398)

### Changed
- Bumped AI SDK and associated packages version. [#404](https://github.com/sourcebot-dev/sourcebot/pull/404)
- Bumped form-data package version. [#407](https://github.com/sourcebot-dev/sourcebot/pull/407)
- Bumped next version. [#406](https://github.com/sourcebot-dev/sourcebot/pull/406)
- [ask sb] Improved search code tool with filter options. [#400](https://github.com/sourcebot-dev/sourcebot/pull/400)
- [ask sb] Removed search scope constraint. [#400](https://github.com/sourcebot-dev/sourcebot/pull/400)
- Update README with new features and videos. [#410](https://github.com/sourcebot-dev/sourcebot/pull/410)
- [ask sb] Add back search scope requirement and other UI changes. [#411](https://github.com/sourcebot-dev/sourcebot/pull/411)

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
- [**Breaking Change**] Removed local folder & arbitrary .git repo support. If your deployment depended on these features, please [open a issue](https://github.com/sourcebot-dev/sourcebot/issues/new?template=get_help.md) and let us know.
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
