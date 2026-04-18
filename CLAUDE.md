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

## Code Style

Always use curly braces for `if` statements, with the body on a new line — even for single-line bodies:

```ts
// Correct
if (!value) {
    return;
}
if (condition) {
    doSomething();
}

// Incorrect
if (!value) return;
if (!value) { return; }
if (condition) doSomething();
```

## PostHog Event Naming

- The `wa_` prefix is reserved for events that can ONLY be fired from the web app (e.g., `wa_login_with_github`, `wa_chat_feedback_submitted`).
- Events fired from multiple sources (web app, MCP server, API) must NOT use the `wa_` prefix (e.g., `ask_message_sent`, `tool_used`).
- Multi-source events should include a `source` property to identify the origin (e.g., `'sourcebot-web-client'`, `'sourcebot-mcp-server'`, `'sourcebot-ask-agent'`).

## Tailwind CSS

Use Tailwind color classes directly instead of CSS variable syntax:

```tsx
// Correct
className="border-border bg-card text-foreground text-muted-foreground bg-muted bg-secondary"

// Incorrect
className="border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
```

## API Route Handlers

When implementing a new API route, ask the user whether it should be part of the public API. If yes:

1. Add the request/response Zod schemas to `packages/web/src/openapi/publicApiSchemas.ts`, calling `.openapi('SchemaName')` on each schema to register it with a name.
2. Register the route in `packages/web/src/openapi/publicApiDocument.ts` using `registry.registerPath(...)`, assigning it to the appropriate tag.
3. Add the endpoint to the relevant group in the `API Reference` tab of `docs/docs.json`.
4. Regenerate the OpenAPI spec by running `yarn workspace @sourcebot/web openapi:generate`.

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

Use `withAuth` or `withOptionalAuth` from `@/middleware/withAuth` to protect server actions and API routes.

- **`withAuth`** - Requires authentication. Returns `notAuthenticated()` if user is not logged in.
- **`withOptionalAuth`** - Allows anonymous access if the org has anonymous access enabled. `user` may be `undefined`.
- **`withMinimumOrgRole`** - Wrap inside auth context to require a minimum role (e.g., `OrgRole.OWNER`). Import from `@/middleware/withMinimumOrgRole`.

**Important:** Always use the `prisma` instance provided by the auth context. This instance has `userScopedPrismaClientExtension` applied, which enforces repository visibility rules (e.g., filtering repos based on user permissions). Do NOT import `prisma` directly from `@/prisma` in actions or routes that return data to the client.

**Server actions** - Wrap with `sew()` for error handling:

```ts
'use server';

import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";

export const myProtectedAction = async ({ id }: { id: string }) => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        // user is guaranteed to be defined
        // prisma is scoped to the user
        return { success: true };
    })
);

export const myPublicAction = async ({ id }: { id: string }) => sew(() =>
    withOptionalAuth(async ({ org, user, prisma }) => {
        // user may be undefined for anonymous access
        return { success: true };
    })
);
```

**API routes** - Check `isServiceError` and return `serviceErrorResponse`:

```ts
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuth } from "@/middleware/withAuth";

export const GET = apiHandler(async (request: NextRequest) => {
    const result = await withAuth(async ({ org, user, prisma }) => {
        // ... your logic
        return data;
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
```

## Next.js Router Navigation

Do NOT call `router.refresh()` immediately after `router.push()`. In Next.js 16, the prefetch cache and navigation system was completely rewritten, and calling `router.refresh()` right after `router.push()` creates a race condition. The refresh invalidates the cache and can interrupt the in-flight navigation, leaving the page stuck or not loading.

```ts
// Bad - router.refresh() races with router.push() in Next.js 16
router.push(url);
router.refresh(); // ❌ can cancel the navigation

// Good - if navigating to a new route, the page will fetch fresh data on load
router.push(url); // ✅
```

If you need to refresh server component data after a mutation, use the server-side `refresh()` from `next/cache` in a Server Action instead of `router.refresh()` on the client.

## Documentation Writing Style

When writing or editing `.mdx` files in `docs/`:

- Do NOT use em dashes (`—`). Use periods to break sentences, commas, or parentheses instead.
- Write in second person ("you") and present tense.
- Keep sentences short and direct. Lead with what the user needs to know.
- Use bold for UI elements and key terms (e.g., **Settings → API Keys**).
- Use inline code for technical values, flags, and identifiers (e.g., `REPO_READ`).
- Prefer short paragraphs (1-3 sentences). Use bullet lists to break up dense information.
- Use tables for parameter documentation.

## Docs Images

Images added to `.mdx` files in `docs/` should be wrapped in a `<Frame>` component:

```mdx
<Frame>
  <img src="/images/my_image.png" alt="Description" />
</Frame>
```

## Branches and Pull Requests

When creating a branch or opening a PR, ask the user for:
1. The Linear issue ID (if available)
2. The GitHub issue number (if available)

Branch naming convention:
- General: `<username>/<branch_name>-<linear_issue_id>`
- Bug fixes: `<username>/fix-<linear_issue_id>`
- If no Linear issue ID is available, omit it from the branch name

PR title should follow conventional commit standards:
- `feat:` new feature or functionality
- `fix:` bug fix
- `docs:` documentation or README changes
- `chore:` maintenance tasks, dependency updates, etc.
- `refactor:` code refactoring without changing behavior
- `test:` adding or updating tests

You can optionally include a scope to indicate which package is affected:
- `feat(web):` feature in the web package
- `fix(worker):` bug fix in the worker package (`backend/`)

PR description:
- If a GitHub issue number was provided, include `Fixes #<github_issue_number>` in the PR description
- If a Linear issue ID was provided (e.g., SOU-123), include `Fixes SOU-123` at the top of the PR description to auto-link the PR to the Linear issue

Before pushing:
- ALWAYS run `yarn test` and `yarn workspace @sourcebot/web build` before pushing to ensure tests pass and the build succeeds
- Do not push code that fails tests or breaks the build

After the PR is created:
- Update CHANGELOG.md with an entry under `[Unreleased]` linking to the new PR. New entries should be placed at the bottom of their section.
- Do NOT add a CHANGELOG entry for documentation-only changes (e.g., changes only in `docs/`)
- Enterprise-only features (gated by an entitlement) should be prefixed with `[EE]` in the CHANGELOG entry (e.g., `- [EE] Added support for ...`)
