import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import rule from './requireAuthWrapper.mjs';

const ROUTE_FILE = '/repo/packages/web/src/app/api/something/route.ts';
const ACTION_FILE = '/repo/packages/web/src/features/example/actions.ts';
const PLAIN_TS_FILE = '/repo/packages/web/src/lib/utils.ts';

const ruleTester = new RuleTester({
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: 'module',
    },
});

describe('authz/require-auth-wrapper', () => {
    it('runs the rule against fixtures', () => {
        ruleTester.run('require-auth-wrapper', rule, {
            valid: [
                // 1. Route handler with withAuth → pass
                {
                    filename: ROUTE_FILE,
                    code: `
                        import { withAuth } from '@/middleware/withAuth';
                        export const GET = async () => {
                            return withAuth(async ({ user }) => ({ id: user.id }));
                        };
                    `,
                },
                // 2. Route handler with withOptionalAuth → pass
                {
                    filename: ROUTE_FILE,
                    code: `
                        import { withOptionalAuth } from '@/middleware/withAuth';
                        export const POST = async (req) => {
                            return withOptionalAuth(async ({ org }) => ({ orgId: org.id }));
                        };
                    `,
                },
                // 5. Route handler with allowlist comment → pass
                // RuleTester prefixes the rule ID with `rule-to-test/`; in real
                // usage the directive would be `authz/require-auth-wrapper`.
                {
                    filename: ROUTE_FILE,
                    code: `
                        // eslint-disable-next-line rule-to-test/require-auth-wrapper -- public health check
                        export const GET = async () => new Response('ok');
                    `,
                },
                // 6. Server action with withAuth → pass
                {
                    filename: ACTION_FILE,
                    code: `
                        'use server';
                        import { withAuth } from '@/middleware/withAuth';
                        export const doThing = async () => withAuth(async ({ user }) => user.id);
                    `,
                },
                // 8. Non-route, non-action TS file → not checked
                {
                    filename: PLAIN_TS_FILE,
                    code: `
                        export const helper = () => 42;
                        export function noop() { return null; }
                    `,
                },
                // Per-function 'use server' WITH withAuth → pass
                {
                    filename: PLAIN_TS_FILE,
                    code: `
                        import { withAuth } from '@/middleware/withAuth';
                        export const action = async () => {
                            'use server';
                            return withAuth(async ({ user }) => user.id);
                        };
                    `,
                },
                // Route handler wrapped in apiHandler with nested withAuth → pass
                {
                    filename: ROUTE_FILE,
                    code: `
                        import { apiHandler } from '@/lib/apiHandler';
                        import { withAuth } from '@/middleware/withAuth';
                        export const PATCH = apiHandler(async (req) =>
                            withAuth(async ({ prisma }) => prisma.user.findMany())
                        );
                    `,
                },
                // 'use server' file with a const that is not exported and is not a function → not flagged
                {
                    filename: ACTION_FILE,
                    code: `
                        'use server';
                        const PRIVATE_CONSTANT = 'foo';
                        export const myAction = async () => {
                            const { withAuth } = await import('@/middleware/withAuth');
                            return withAuth(async () => null);
                        };
                    `,
                },
            ],
            invalid: [
                // 3. Route handler with neither → fail
                {
                    filename: ROUTE_FILE,
                    code: `
                        export const GET = async () => new Response('hello');
                    `,
                    errors: [{ messageId: 'missingWrapperRoute', data: { name: 'GET' } }],
                },
                // 4. Route handler with only withMinimumOrgRole (no withAuth) → fail
                {
                    filename: ROUTE_FILE,
                    code: `
                        import { withMinimumOrgRole } from '@/middleware/withMinimumOrgRole';
                        export const DELETE = async ({ role }) =>
                            withMinimumOrgRole(role, 'OWNER', async () => null);
                    `,
                    errors: [{ messageId: 'missingWrapperRoute', data: { name: 'DELETE' } }],
                },
                // 7. Server action without withAuth → fail
                {
                    filename: ACTION_FILE,
                    code: `
                        'use server';
                        export const leakyAction = async () => {
                            return { everything: 'about everyone' };
                        };
                    `,
                    errors: [{ messageId: 'missingWrapperAction', data: { name: 'leakyAction' } }],
                },
                // Per-function 'use server' without withAuth → fail
                {
                    filename: PLAIN_TS_FILE,
                    code: `
                        export const action = async () => {
                            'use server';
                            return { data: 'leak' };
                        };
                    `,
                    errors: [{ messageId: 'missingWrapperAction', data: { name: 'action' } }],
                },
                // export const { GET, POST } = handlers — both flagged
                {
                    filename: ROUTE_FILE,
                    code: `
                        import { handlers } from '@/auth';
                        export const { GET, POST } = handlers;
                    `,
                    errors: [
                        { messageId: 'missingWrapperRoute', data: { name: 'GET' } },
                        { messageId: 'missingWrapperRoute', data: { name: 'POST' } },
                    ],
                },
                // export { handler as GET, handler as POST } — both flagged when local does not call withAuth
                {
                    filename: ROUTE_FILE,
                    code: `
                        const handler = () => new Response(null, { status: 404 });
                        export { handler as GET, handler as POST };
                    `,
                    errors: [
                        { messageId: 'missingWrapperRoute', data: { name: 'GET' } },
                        { messageId: 'missingWrapperRoute', data: { name: 'POST' } },
                    ],
                },
                // exported function declaration in a 'use server' file → fail
                {
                    filename: ACTION_FILE,
                    code: `
                        'use server';
                        export async function fetchSecret() {
                            return 'secret';
                        }
                    `,
                    errors: [{ messageId: 'missingWrapperAction', data: { name: 'fetchSecret' } }],
                },
                // withAuth appears outside the export body (sibling helper) → fail
                {
                    filename: ROUTE_FILE,
                    code: `
                        import { withAuth } from '@/middleware/withAuth';
                        const _unused = () => withAuth(async () => null);
                        export const GET = async () => new Response('leak');
                    `,
                    errors: [{ messageId: 'missingWrapperRoute', data: { name: 'GET' } }],
                },
            ],
        });
    });
});
