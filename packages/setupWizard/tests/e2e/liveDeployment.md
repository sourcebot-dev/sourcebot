# Live deployment verification

Run `liveDeployment.mjs` with Node 24 on macOS or Linux with Docker available.
It builds and installs the actual npm tarball in a disposable directory, drives
the interactive CLI through a PTY, starts the real Sourcebot/Postgres/Redis stack,
onboards a synthetic owner through Chromium, verifies indexing and authenticated
search, then verifies health, search, and install-ID continuity after restart.

Pull `docker.sourcebot.dev/sourcebot-dev/sourcebot:v5.1.13`, `postgres:16`, and
`redis:8` first. The default scenario is `github_repo`. For the public/configuration
matrix, set:

```sh
SETUP_TEST_LIVE_CASES=github_repo,github_org,github_user,gitlab_project,gitea_repo,gerrit_project,remote_git,local_root,local_wildcard,local_nested,auto_start,ai_all \
SETUP_TEST_LIVE_OUTPUT=/absolute/path/outside/the/repository \
node packages/setupWizard/tests/e2e/liveDeployment.mjs
```

The optional `anthropic` scenario reads `ANTHROPIC_API_KEY` from development env
files under `SETUP_TEST_CREDENTIAL_DIR`. Never pass the credential as a command
argument. `ai_all` configures all twelve providers with synthetic values. Neither
scenario calls Ask or an inference endpoint; neither proves credential validity
or requires a Pro license. The tests check generated model configuration,
credential references, container environment propagation, and successful startup.

Every deployment uses a unique Compose project, random loopback HTTP port, and
unpublished database/Redis ports. The Compose download is intercepted only to
apply these isolation settings, pin the image, and disable deployment telemetry.
The wizard's generated config, `.env`, identity, and local-repository override
remain intact. Wizard PostHog requests use the real SDK and are routed to the
local TLS collector; live public autocomplete/model-catalog requests remain real.
This suite does not forward to production or dev PostHog. The separate dev smoke
test provides actual ingestion/query evidence.

Public fixtures are bounded: one explicit repository/project per host, the
small `chalk` organization, and the `octocat` user. Organization/user tests obtain
the expected repository count before starting and require all repositories to
be discovered and indexed. Multi-local tests clone two distinct origins because
Sourcebot deduplicates multiple local clones of the same origin.

Each scenario records success/failure and removes its containers, volumes,
network, generated secrets, and temporary files in cleanup. Only redacted reports
and browser screenshots remain when an output directory is supplied. Task-owned
image downloads should be removed by the operator afterward without removing
images that existed before the run. Do not commit generated artifacts.

This live matrix supplements, not replaces, the deterministic collector, fault,
transport, lifecycle, and platform suites. It does not establish live access to
private/GHE/GitLab self-managed, Azure DevOps, or Bitbucket deployments, and does
not claim every possible code-host scope or credential mode has live coverage.
Unavailable integrations must remain explicitly unverified in the completion
report rather than being inferred from fixture-based coverage.
