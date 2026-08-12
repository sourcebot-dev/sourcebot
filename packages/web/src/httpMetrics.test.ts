import { describe, expect, it } from 'vitest';
import { buildRouteTable, normalizeRoute } from './httpMetrics';

// Mirrors the shape and ordering of the real .next/routes-manifest.json:
// dynamic routes are listed in Next's resolution priority, with catch-alls
// after specific routes and the root catch-all last.
const table = buildRouteTable({
    staticRoutes: [
        { page: '/' },
        { page: '/search' },
        { page: '/repos' },
        { page: '/api/health' },
        { page: '/api/commits' },
    ],
    dynamicRoutes: [
        { page: '/api/auth/[...nextauth]', regex: '^/api/auth/(.+?)(?:/)?$' },
        { page: '/api/repos/[repoId]/image', regex: '^/api/repos/([^/]+?)/image(?:/)?$' },
        { page: '/api/[...slug]', regex: '^/api/(.+?)(?:/)?$' },
        { page: '/browse/[...path]', regex: '^/browse/(.+?)(?:/)?$' },
        { page: '/settings/[...slug]', regex: '^/settings/(.+?)(?:/)?$' },
        { page: '/[...slug]', regex: '^/(.+?)(?:/)?$' },
    ],
    rewrites: {
        afterFiles: [
            { source: '/ingest/:path*', regex: '^/ingest(?:/(.+?))?(?:/)?$' },
            { source: '/.well-known/oauth-authorization-server', regex: '^/\\.well-known/oauth-authorization-server(?:/)?$' },
            { source: '/.well-known/oauth-protected-resource/:path*', regex: '^/\\.well-known/oauth-protected-resource(?:/(.+?))?(?:/)?$' },
            { source: '/register', regex: '^/register(?:/)?$' },
            { source: '/api/mcp', regex: '^/api/mcp(?:/)?$' },
            { source: '/scim/v2/:path*', regex: '^/scim/v2(?:/(.+?))?(?:/)?$' },
        ],
    },
});

const maxLabels = table.staticPages.size
    + table.dynamicRoutes.length
    + table.beforeFilesRewrites.length
    + table.afterFilesRewrites.length
    + table.fallbackRewrites.length
    + 2; // + '/_next', 'other'

describe('normalizeRoute', () => {
    it('maps the root path', () => {
        expect(normalizeRoute('/', table)).toBe('/');
        expect(normalizeRoute('', table)).toBe('/');
    });

    it('matches static routes exactly', () => {
        expect(normalizeRoute('/api/health', table)).toBe('/api/health');
        expect(normalizeRoute('/search', table)).toBe('/search');
    });

    it('labels dynamic routes with their route pattern', () => {
        expect(normalizeRoute('/api/auth/callback/github', table)).toBe('/api/auth/[...nextauth]');
        expect(normalizeRoute('/api/repos/42/image', table)).toBe('/api/repos/[repoId]/image');
        expect(normalizeRoute('/settings/connections/42', table)).toBe('/settings/[...slug]');
    });

    it('respects manifest ordering: specific routes win over catch-alls', () => {
        // /api/auth/... must hit [...nextauth], not the /api/[...slug] catch-all.
        expect(normalizeRoute('/api/auth/session', table)).toBe('/api/auth/[...nextauth]');
        // Unknown API paths fall through to the catch-all that actually serves them.
        expect(normalizeRoute('/api/not-a-real-route', table)).toBe('/api/[...slug]');
    });

    it('labels rewritten paths with their public source pattern', () => {
        expect(normalizeRoute('/api/mcp', table)).toBe('/api/mcp');
        expect(normalizeRoute('/scim/v2/Users/42', table)).toBe('/scim/v2/:path*');
        expect(normalizeRoute('/.well-known/oauth-authorization-server', table))
            .toBe('/.well-known/oauth-authorization-server');
        expect(normalizeRoute('/.well-known/oauth-protected-resource/api/mcp', table))
            .toBe('/.well-known/oauth-protected-resource/:path*');
        expect(normalizeRoute('/register', table)).toBe('/register');
        expect(normalizeRoute('/ingest/events', table)).toBe('/ingest/:path*');
    });

    it('matches rewrites in Next routing order', () => {
        const precedenceTable = buildRouteTable({
            staticRoutes: [
                { page: '/docs' },
                { page: '/api/health' },
            ],
            dynamicRoutes: [
                { page: '/api/[...slug]', regex: '^/api/(.+?)(?:/)?$' },
                { page: '/browse/[...path]', regex: '^/browse/(.+?)(?:/)?$' },
            ],
            rewrites: {
                beforeFiles: [{ source: '/docs/:path*', regex: '^/docs(?:/(.+?))?(?:/)?$' }],
                afterFiles: [{ source: '/api/:path*', regex: '^/api/(.+?)(?:/)?$' }],
                fallback: [{ source: '/:path*', regex: '^/(.+?)(?:/)?$' }],
            },
        });

        expect(normalizeRoute('/docs', precedenceTable)).toBe('/docs/:path*');
        expect(normalizeRoute('/api/health', precedenceTable)).toBe('/api/health');
        expect(normalizeRoute('/api/mcp', precedenceTable)).toBe('/api/:path*');
        expect(normalizeRoute('/browse/org/repo', precedenceTable)).toBe('/browse/[...path]');
        expect(normalizeRoute('/unmatched', precedenceTable)).toBe('/:path*');
    });

    it('collapses unbounded repository and file paths to one label', () => {
        const a = normalizeRoute('/browse/github.com/org/repo/-/blob/src/index.ts', table);
        const b = normalizeRoute('/browse/github.com/other/repo/-/blob/lib/other.ts', table);

        expect(a).toBe('/browse/[...path]');
        expect(b).toBe(a);
    });

    it('is unaffected by trailing or duplicate slashes', () => {
        expect(normalizeRoute('/search/', table)).toBe('/search');
        expect(normalizeRoute('//search//', table)).toBe('/search');
        expect(normalizeRoute('/api/health/', table)).toBe('/api/health');
    });

    it('labels asset requests /_next without consulting the table', () => {
        expect(normalizeRoute('/_next/static/chunks/main.js', table)).toBe('/_next');
        expect(normalizeRoute('/_next/image', undefined)).toBe('/_next');
    });

    it('reports everything as other when no table is loaded', () => {
        expect(normalizeRoute('/api/health', undefined)).toBe('other');
        expect(normalizeRoute('/search', undefined)).toBe('other');
    });

    describe('cardinality bounding', () => {
        it('routes scanner traffic to catch-alls, not new labels', () => {
            expect(normalizeRoute('/wp-admin', table)).toBe('/[...slug]');
            expect(normalizeRoute('/.env', table)).toBe('/[...slug]');
            expect(normalizeRoute('/api/12345', table)).toBe('/api/[...slug]');
        });

        it('reports unmatched paths as other when there is no root catch-all', () => {
            const noCatchAll = buildRouteTable({
                staticRoutes: [{ page: '/search' }],
                dynamicRoutes: [{ page: '/api/[...slug]', regex: '^/api/(.+?)(?:/)?$' }],
            });

            expect(normalizeRoute('/wp-admin', noCatchAll)).toBe('other');
            expect(normalizeRoute('/api/anything', noCatchAll)).toBe('/api/[...slug]');
        });

        it('stays bounded under scanner traffic', () => {
            const hostile: string[] = [];
            for (let i = 0; i < 1000; i++) {
                hostile.push(`/scan-${i}`);
                hostile.push(`/api/scan-${i}`);
                hostile.push(`/${i}/${i}/${i}`);
            }

            const labels = new Set(hostile.map(p => normalizeRoute(p, table)));

            // 3,000 distinct hostile paths produce exactly the two catch-all labels.
            expect(labels).toEqual(new Set(['/[...slug]', '/api/[...slug]']));
        });

        it('never exceeds the table-derived bound for any input', () => {
            const paths = [
                '/', '/search', '/repos', '/browse/a/b/c', '/api/health',
                '/api/commits', '/api/auth/session', '/_next/static/x.js',
                '/api/mcp', '/scim/v2/Users/42', '/ingest/events',
                '/wp-admin', '/api/bogus', '/random', '/..%2f', '/a/b/c/d/e',
            ];
            for (let i = 0; i < 500; i++) {
                paths.push(`/junk${i}`, `/api/junk${i}`);
            }

            const labels = new Set(paths.map(p => normalizeRoute(p, table)));

            expect(labels.size).toBeLessThanOrEqual(maxLabels);
            expect(labels).toContain('/api/health');
        });
    });
});
