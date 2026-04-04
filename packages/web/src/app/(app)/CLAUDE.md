# (app) Route Group

## Auth in pages

Use `authenticatedPage` from `@/middleware/authenticatedPage` for all pages in this directory. Do NOT use `SINGLE_TENANT_ORG_ID` or direct `prisma` imports from `@/prisma` to look up the org — use the `org` and `prisma` provided by the auth context instead.

```tsx
import { authenticatedPage } from "@/middleware/authenticatedPage";

export default authenticatedPage(async ({ org, role, prisma }, props) => {
    // ...
});
```

Options:
- `{ minRole: OrgRole.OWNER, redirectTo: '/settings' }` — gate by role
- `{ allowAnonymous: true }` — allow unauthenticated access (user may be undefined)

## Layout

The `layout.tsx` in this directory handles authentication, org membership, onboarding, and SSO account linking. Pages do not need to re-check these. See `README.md` for the full guard pipeline.

## Adding new routes

New pages automatically inherit the layout's auth/membership guard. Use `authenticatedPage` if the page needs the auth context (org, user, role, prisma) or role-based gating.
