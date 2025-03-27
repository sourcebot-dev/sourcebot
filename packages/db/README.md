# @sourcebot/db

This package contains the database schema (prisma/schema.prisma), migrations (prisma/migrations) and the client library for interacting with the database. Before making edits to the schema, please read about prisma's [migration model](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/mental-model) to get an idea of how migrations work.

## Tools

This library contains a `/tools` directory with a collection of tooling needed for database management. Notable tools are:

- `yarn tool:prisma` - runs the prisma CLI with an additional required param `--url`, the connection URL of the database you want the command to run against. This tool is geared towards running commands against non-dev database like staging or prod since 1) it allows you to quickly switch between environments, and 2) connection URLs do not need to be persisted in a `DATABASE_URL` environment variable. Examples:

```sh
# Run prisma studio
yarn tool:prisma studio --url postgresql://username:password@url:5432/db_name

# Rollback a migration
yarn tool:prisma migrate resolve --rolled-back "migration_name" --url postgresql://username:password@url:5432/db_name
```

- `yarn tool:run-script` - runs a script (located in the `/tools/scripts` directory) that performs some operations against the DB. This is useful for writing bespoke CRUD operations while still being type-safe and having all the perks of the prisma client lib.

```sh
# Run `migrate-duplicate-connections.ts`
yarn tool:run-script --script  migrate-duplicate-connections --url postgresql://username:password@url:5432/db_name
```
