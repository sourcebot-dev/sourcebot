import { withAuth, withOptionalAuth } from "./withAuth";
import { isServiceError } from "@/lib/utils";
import { Org, OrgRole, PrismaClient, UserWithAccounts } from "@sourcebot/db";
import { redirect } from "next/navigation";

type RequiredPageAuthContext = {
    user: UserWithAccounts;
    org: Org;
    role: Exclude<OrgRole, 'GUEST'>;
    prisma: PrismaClient;
}

type OptionalPageAuthContext = {
    user?: UserWithAccounts;
    org: Org;
    role: OrgRole;
    prisma: PrismaClient;
}

type RequiredAuthOptions = {
    allowAnonymous?: false;
    minRole?: OrgRole;
    redirectTo?: string;
}

type OptionalAuthOptions = {
    allowAnonymous: true;
    minRole?: never;
    redirectTo?: never;
}

type AuthenticatedPageOptions = RequiredAuthOptions | OptionalAuthOptions;

type AuthContextFor<O extends AuthenticatedPageOptions | undefined> =
    O extends { allowAnonymous: true } ? OptionalPageAuthContext : RequiredPageAuthContext;

const ROLE_PRECEDENCE: Record<OrgRole, number> = {
    [OrgRole.GUEST]: 0,
    [OrgRole.MEMBER]: 1,
    [OrgRole.OWNER]: 2,
};

/**
 * HOC that wraps a page component with auth. The page receives the
 * auth context as its first argument, and the original page props
 * as its second.
 *
 * The auth context type narrows based on the options:
 * - Default: `user` is always defined, `role` excludes GUEST
 * - `{ allowAnonymous: true }`: `user` may be undefined, allows anonymous access
 *
 * @example
 * // Required auth (user is always defined)
 * export default authenticatedPage(async ({ org, prisma }) => {
 *     const repos = await prisma.repo.findMany({ ... });
 *     return <ReposTable data={repos} />;
 * });
 *
 * @example
 * // With role gating
 * export default authenticatedPage(async ({ org }) => {
 *     return <SettingsPage org={org} />;
 * }, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
 *
 * @example
 * // Anonymous access allowed (user may be undefined)
 * export default authenticatedPage(async ({ user, prisma }) => {
 *     return <PublicPage />;
 * }, { allowAnonymous: true });
 */
export function authenticatedPage<
    P extends Record<string, unknown> = Record<string, never>,
    O extends AuthenticatedPageOptions = RequiredAuthOptions,
>(
    fn: (auth: AuthContextFor<O>, props: P) => Promise<React.ReactElement>,
    opts?: O,
) {
    return async (props: P) => {
        if (opts && 'allowAnonymous' in opts && opts.allowAnonymous) {
            const result = await withOptionalAuth(async (ctx) => ctx);

            if (isServiceError(result)) {
                redirect('/login');
            }

            return fn(result as AuthContextFor<O>, props);
        } else {
            const result = await withAuth(async (ctx) => ctx);

            if (isServiceError(result)) {
                redirect('/login');
            }

            const requiredOpts = opts as RequiredAuthOptions | undefined;
            if (requiredOpts?.minRole) {
                if (ROLE_PRECEDENCE[result.role] < ROLE_PRECEDENCE[requiredOpts.minRole]) {
                    redirect(requiredOpts.redirectTo ?? '/');
                }
            }

            return fn(result as AuthContextFor<O>, props);
        }
    };
}
