# (app) Route Group

This is a Next.js [route group](https://nextjs.org/docs/app/building-your-application/routing/route-groups). The parenthesized folder name does not affect the URL structure. Routes here are served at the root (e.g., `/search`, `/chat`, `/settings`).

## Why this route group exists

Routes outside `(app)/` (like `/login`, `/signup`, `/invite`, `/onboard`) are accessible without authentication. Routes inside `(app)/` go through the layout's auth and membership guards before rendering.

## What the layout does

The `layout.tsx` acts as a gate and app shell. It runs the following checks in order, short-circuiting if any condition is met:

1. **Org existence** - Looks up the single-tenant org by `SINGLE_TENANT_ORG_ID`. Returns 404 if missing.
2. **Authentication** - If the user is not logged in and anonymous access is not enabled, redirects to `/login` (or renders GCP IAP auth if configured).
3. **Membership** - If the user is logged in but not a member of the org, renders one of:
   - `JoinOrganizationCard` if the org does not require approval
   - `SubmitJoinRequest` / `PendingApprovalCard` if the org requires approval
4. **Onboarding** - If the org has not completed onboarding, wraps children in `OnboardGuard`.
5. **SSO account linking** - If required SSO providers are not linked, renders `ConnectAccountsCard`.
6. **Mobile splash screen** - Shows an unsupported screen on mobile devices (dismissible via cookie).

After all guards pass, the layout wraps children with shared UI: `SyntaxGuideProvider`, `PermissionSyncBanner`, `GitHubStarToast`, and `UpgradeToast`.

## What the layout does NOT do

- **Role-based access control** - The layout does not check `OWNER` vs `MEMBER`. Pages that require a specific role should use `authenticatedPage` with the `minRole` option.
- **Guarantee a user exists** - When anonymous access is enabled, the user may be undefined.

## Writing pages in (app)

Use the `authenticatedPage` HOC from `@/middleware/authenticatedPage`. It resolves the auth context (`user`, `org`, `role`, `prisma`) and handles redirects on auth failure. This avoids manual org lookups with `SINGLE_TENANT_ORG_ID` — pages inside `(app)/` should not reference that constant directly.

```tsx
import { authenticatedPage } from "@/middleware/authenticatedPage";

// Basic authenticated page
export default authenticatedPage(async ({ prisma }) => {
    const data = await prisma.repo.findMany();
    return <MyPage data={data} />;
});

// Owner-only page
export default authenticatedPage(async ({ org }) => {
    return <AdminPage orgName={org.name} />;
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });

// Page that allows anonymous access
export default authenticatedPage(async ({ user, prisma }) => {
    // user may be undefined
    return <PublicPage />;
}, { allowAnonymous: true });
```
