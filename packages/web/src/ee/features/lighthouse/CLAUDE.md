# Lighthouse Feature Guidelines

## Keeping types in sync with the lighthouse service

The Zod schemas in `types.ts` mirror the request/response schemas defined in the lighthouse service (`sourcebot-dev/lighthouse`, under `lambda/routes/`). They MUST stay in lockstep.

Whenever you change a schema in `types.ts`, you MUST also update the corresponding schema in:

```
lighthouse: lambda/routes/<route>.ts
```

Conversely, if a schema changes in the lighthouse service, update `types.ts` here to match.

This applies to:
- Adding, removing, or renaming fields on any `*RequestSchema` / `*ResponseSchema`.
- Changing a field's type, nullability, or validation (e.g. `.optional()`, `.nullable()`, `.datetime()`).
- Adding new route schemas.
