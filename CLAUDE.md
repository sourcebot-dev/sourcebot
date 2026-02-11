# Claude Code Guidelines

## Database Migrations

When creating Prisma database migrations, run from the repository root:

```bash
yarn dev:prisma:migrate:dev --name <migration_name>
```

Do NOT use `npx prisma migrate dev` directly from packages/db.

## Building Packages

To build a specific package:

```bash
yarn workspace @sourcebot/<package-name> build
```

## Tailwind CSS

Use Tailwind color classes directly instead of CSS variable syntax:

```tsx
// Correct
className="border-border bg-card text-foreground text-muted-foreground bg-muted bg-secondary"

// Incorrect
className="border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
```

## Branches and Pull Requests

When creating a branch or opening a PR, ask the user for:
1. The Linear issue ID (if available)
2. The GitHub issue number (if available)

Branch naming convention:
- General: `<username>/<branch_name>-<linear_issue_id>`
- Bug fixes: `<username>/fix-<linear_issue_id>`
- If no Linear issue ID is available, omit it from the branch name

PR description:
- If a GitHub issue number was provided, include `Fixes #<github_issue_number>` in the PR description

After the PR is created:
- Update CHANGELOG.md with an entry under `[Unreleased]` linking to the new PR
- If the change touches `packages/mcp`, update `packages/mcp/CHANGELOG.md` instead
