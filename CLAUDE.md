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

## File Naming

Files should use camelCase starting with a lowercase letter:

```
// Correct
shareChatPopover.tsx
userAvatar.tsx
apiClient.ts

// Incorrect
ShareChatPopover.tsx
UserAvatar.tsx
share-chat-popover.tsx
```

Exceptions:
- Special files like `README.md`, `CHANGELOG.md`, `LICENSE`
- Next.js conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, etc.

## Tailwind CSS

Use Tailwind color classes directly instead of CSS variable syntax:

```tsx
// Correct
className="border-border bg-card text-foreground text-muted-foreground bg-muted bg-secondary"

// Incorrect
className="border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
```

## API Route Handlers

Route handlers should validate inputs using Zod schemas.

**Query parameters** (GET requests):

```ts
import { queryParamsSchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { z } from "zod";

const myQueryParamsSchema = z.object({
    q: z.string().default(''),
    page: z.coerce.number().int().positive().default(1),
});

export const GET = apiHandler(async (request: NextRequest) => {
    const rawParams = Object.fromEntries(
        Object.keys(myQueryParamsSchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined
        ])
    );
    const parsed = myQueryParamsSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const { q, page } = parsed.data;
    // ... rest of handler
});
```

**Request body** (POST/PUT/PATCH requests):

```ts
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { z } from "zod";

const myRequestBodySchema = z.object({
    name: z.string(),
    count: z.number().optional(),
});

export const POST = apiHandler(async (request: NextRequest) => {
    const body = await request.json();
    const parsed = myRequestBodySchema.safeParse(body);

    if (!parsed.success) {
        return serviceErrorResponse(
            requestBodySchemaValidationError(parsed.error)
        );
    }

    const { name, count } = parsed.data;
    // ... rest of handler
});
```

## Data Fetching

For GET requests, prefer using API routes with react-query over server actions. This provides caching benefits and better control over data refetching.

```tsx
// Preferred: API route + react-query
import { useQuery } from "@tanstack/react-query";

const { data, isLoading } = useQuery({
    queryKey: ["items", id],
    queryFn: () => fetch(`/api/items/${id}`).then(res => res.json()),
});
```

Server actions should be used for mutations (POST/PUT/DELETE operations), not for data fetching.

## Authentication

Use `withAuthV2` or `withOptionalAuthV2` from `@/withAuthV2` to protect server actions and API routes.

- **`withAuthV2`** - Requires authentication. Returns `notAuthenticated()` if user is not logged in.
- **`withOptionalAuthV2`** - Allows anonymous access if the org has anonymous access enabled. `user` may be `undefined`.
- **`withMinimumOrgRole`** - Wrap inside auth context to require a minimum role (e.g., `OrgRole.OWNER`).

**Important:** Always use the `prisma` instance provided by the auth context. This instance has `userScopedPrismaClientExtension` applied, which enforces repository visibility rules (e.g., filtering repos based on user permissions). Do NOT import `prisma` directly from `@/prisma` in actions or routes that return data to the client.

**Server actions** - Wrap with `sew()` for error handling:

```ts
'use server';

import { sew } from "@/actions";
import { withAuthV2 } from "@/withAuthV2";

export const myProtectedAction = async ({ id }: { id: string }) => sew(() =>
    withAuthV2(async ({ org, user, prisma }) => {
        // user is guaranteed to be defined
        // prisma is scoped to the user
        return { success: true };
    })
);

export const myPublicAction = async ({ id }: { id: string }) => sew(() =>
    withOptionalAuthV2(async ({ org, user, prisma }) => {
        // user may be undefined for anonymous access
        return { success: true };
    })
);
```

**API routes** - Check `isServiceError` and return `serviceErrorResponse`:

```ts
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuthV2 } from "@/withAuthV2";

export const GET = apiHandler(async (request: NextRequest) => {
    const result = await withAuthV2(async ({ org, user, prisma }) => {
        // ... your logic
        return data;
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
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
- Update CHANGELOG.md with an entry under `[Unreleased]` linking to the new PR. New entries should be placed at the bottom of their section.
- If the change touches `packages/mcp`, update `packages/mcp/CHANGELOG.md` instead
