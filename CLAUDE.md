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
