# Lighthouse Feature Guidelines

## Keeping types in sync with the lighthouse service

The Zod schemas in `packages/shared/src/lighthouseTypes.ts` mirror the request/response schemas defined in the lighthouse service (`sourcebot-dev/lighthouse`, under `lambda/routes/`). They MUST stay in lockstep.

Whenever you change a schema in `packages/shared/src/lighthouseTypes.ts`, you MUST also update the corresponding schema in:

```
lighthouse: lambda/routes/<route>.ts
```

Conversely, if a schema changes in the lighthouse service, update `packages/shared/src/lighthouseTypes.ts` to match.

This applies to:
- Adding, removing, or renaming fields on any `*RequestSchema` / `*ResponseSchema`.
- Changing a field's type, nullability, or validation (e.g. `.optional()`, `.nullable()`, `.datetime()`).
- Adding new route schemas.

## Keeping the Service Ping docs in sync

Whenever you change the `servicePingRequestSchema` (the `/ping` request payload) in `packages/shared/src/lighthouseTypes.ts`, you MUST also update the user-facing Service Ping documentation:

```
docs/docs/misc/service-ping.mdx
```

This includes updating the field reference table and the example payload to reflect any added, removed, or renamed fields.
