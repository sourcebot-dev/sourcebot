# Contributing to Sourcebot

So you're interested in contributing to Sourcebot. Great!

## Understanding the Licenses

First thing to know is that Sourcebot is not a side-project - it is a product of a pretty cool company based in San Francisco who build and maintain it professionally. For this reason, Sourcebot follows the [open core](https://en.wikipedia.org/wiki/Open-core_model) business model, which splits the codebase into two parts: **core** and **ee**, which each have their own license:

- **core** code is licensed under the [Functional Source License](https://fsl.software/), a
mostly permissive non-compete license that converts to Apache 2.0 or MIT after two years. Code shipped in core (without ee) forms the [Sourcebot Community Edition (CE)](https://www.sourcebot.dev/pricing).
- **ee (enterprise)** code is licensed under the [Sourcebot Enterprise License](ee/license), a commercial license that covers our enterprise offering. Usage of ee code requires a valid license key. Code shipped in core **and** ee forms the [Sourcebot Enterprise Edition (EE)](https://www.sourcebot.dev/pricing).

You can take a look at the root [LICENSE.md](LICENSE.md) for a breakdown of what code is core or ee.

For contributing, the breakdown is as follows:

- **core** : you're free to contribute, but you can't take this and use it to compete with us. You can, however, otherwise use it however you want. Your changes will convert to Apache 2.0 after two years.
- **ee** : you can also contribute, but Sourcebot retains all rights to your modifications and patches. Your contributions can only be used in production by those with a valid Enterprise license. You can freely experiment with ee code for non-production evaluation purposes without a license.

## Contributor Policy

We want to make it easy to contribute to Sourcebot. Here are the most common types of changes that get merged:
- Bug fixes
- Improvements to our code host integrations
- Additional LLM providers
- Documentation improvements

However, any UI or core proudct feature must go through a design review with the core team before implementation. If you're unsure if your PR would be accepted, ask a maintainer.

> [!NOTE]
> PRs that ignore these guardrails will likely be closed.

Want to take on an issue? Leave a comment and a maintainer may assign it to you unless it is something we are already working on.

## Developing Sourcebot

1. Install <a href="https://go.dev/doc/install"><img src="https://go.dev/favicon.ico" width="16" height="16"> go</a>, <a href="https://docs.docker.com/get-started/get-docker/"><img src="https://www.docker.com/favicon.ico" width="16" height="16"> docker</a>, and <a href="https://nodejs.org/"><img src="https://nodejs.org/favicon.ico" width="16" height="16"> NodeJS</a>. Note that a NodeJS version of at least `24` is required.

2. Install [ctags](https://github.com/universal-ctags/ctags) (required by zoekt)
    ```sh
    // macOS:
    brew install universal-ctags

    // Linux:
    snap install universal-ctags
    ```

3. Install corepack:
    ```sh
    npm install -g corepack
    ```

3. Install `yarn`:
    ```sh
    npm install --global yarn
    ```

3. Clone the repository with submodules:
    ```sh
    git clone --recurse-submodules https://github.com/sourcebot-dev/sourcebot.git
    ```
4. Run `make` to build zoekt and install dependencies:
    ```sh
    cd sourcebot
    make
    ```

    The zoekt binaries and web dependencies are placed into `bin` and `node_modules` respectively.

    **Note**: `make` should also be run whenever switching between branches to ensure all dependencies are upto date.

5. Start the development Docker containers for PostgreSQL and Redis.

    ```sh
    docker compose -f docker-compose-dev.yml up -d
    ```

6. Generate the database schema.
    ```sh
    yarn dev:prisma:migrate:dev
    ```

7. Create a copy of `.env.development` and name it `.env.development.local`. Update the required environment variables.

8. If you're using a declarative configuration file, create a configuration file and update the `CONFIG_PATH` environment variable in your `.env.development.local` file.

9. Start Sourcebot with the command:
    ```sh
    yarn dev
    ```

    A `.sourcebot` directory will be created and zoekt will begin to index the repositories found in the `config.json` file.

10. Start searching at `http://localhost:3000`.

## Pull Request Expectations

### Issue First Policy

**All PRs must reference an existing issue.** Before opening a PR, open an issue describing the bug or feature. This helps maintainers triage and prevents duplicate work. PRs without a linked issue may be closed without review.

- Use `Fixes #123` or `Closes #123` in your PR description to link the issue
- For small fixes, a brief issue is fine - just enough context for maintainers to understand the problem

### General Requirements

- Keep pull requests small and focused
- Explain the issue and why your change fixes it
- Before adding new functionality, ensure it doesn't already exist elsewhere in the codebase

### UI Changes

If your PR includes UI changes, please include screenshots or videos showing the before and after. This helps maintainers review faster and gives you quicker feedback.

### Logic Changes

For non-UI changes (bug fixes, new features, refactors), explain **how you verified it works**:

- What did you test?
- How can a reviewer reproduce/confirm the fix?

### No AI-Generated Walls of Text

Long, AI-generated PR descriptions and issues are not acceptable and may be ignored. Respect the maintainers' time:

- Write short, focused descriptions
- Explain what changed and why in your own words
- If you can't explain it briefly, your PR might be too large

### PR Titles

PR titles should follow conventional commit standards:

- `feat:` new feature or functionality
- `fix:` bug fix
- `docs:` documentation or README changes
- `chore:` maintenance tasks, dependency updates, etc.
- `refactor:` code refactoring without changing behavior
- `test:` adding or updating tests

You can optionally include a scope to indicate which package is affected:

- `feat(web):` feature in the web package
- `fix(worker):` bug fix in the worker package (`backend/`)
