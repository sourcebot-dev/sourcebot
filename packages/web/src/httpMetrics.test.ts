import { describe, expect, it } from 'vitest';
import { MAX_ROUTE_LABELS, normalizeRoute } from './httpMetrics';

describe('normalizeRoute', () => {
    it('maps the root path', () => {
        expect(normalizeRoute('/')).toBe('/');
        expect(normalizeRoute('')).toBe('/');
    });

    it('keeps two segments for known API routes', () => {
        expect(normalizeRoute('/api/health')).toBe('/api/health');
        expect(normalizeRoute('/api/commits')).toBe('/api/commits');
        expect(normalizeRoute('/api/auth/callback/github')).toBe('/api/auth');
    });

    it('keeps one segment for known page routes', () => {
        expect(normalizeRoute('/search')).toBe('/search');
        expect(normalizeRoute('/settings/connections/42')).toBe('/settings');
    });

    it('collapses unbounded repository and file paths', () => {
        const a = normalizeRoute('/browse/github.com/org/repo/-/blob/src/index.ts');
        const b = normalizeRoute('/browse/github.com/other/repo/-/blob/lib/other.ts');

        expect(a).toBe('/browse');
        expect(b).toBe(a);
    });

    it('is unaffected by trailing or duplicate slashes', () => {
        expect(normalizeRoute('/search/')).toBe('/search');
        expect(normalizeRoute('//search//')).toBe('/search');
    });

    describe('cardinality bounding', () => {
        it('reports unknown top-level paths as other', () => {
            expect(normalizeRoute('/wp-admin')).toBe('other');
            expect(normalizeRoute('/.env')).toBe('other');
            expect(normalizeRoute('/phpmyadmin/index.php')).toBe('other');
        });

        it('reports unknown API paths as other, despite the [...slug] catch-all', () => {
            expect(normalizeRoute('/api/not-a-real-route')).toBe('other');
            expect(normalizeRoute('/api/12345')).toBe('other');
            expect(normalizeRoute('/api/health-check')).toBe('other');
        });

        it('stays bounded under scanner traffic', () => {
            const hostile: string[] = [];
            for (let i = 0; i < 1000; i++) {
                hostile.push(`/scan-${i}`);
                hostile.push(`/api/scan-${i}`);
                hostile.push(`/${i}/${i}/${i}`);
            }

            const labels = new Set(hostile.map(normalizeRoute));

            // 3000 distinct hostile paths must produce exactly one label.
            expect(labels).toEqual(new Set(['other']));
        });

        it('never exceeds the documented label bound for any input', () => {
            const paths = [
                '/', '/search', '/repos', '/settings/general', '/browse/a/b/c',
                '/api/health', '/api/commits', '/api/auth/session', '/_next/static/x.js',
                '/wp-admin', '/api/bogus', '/random', '/api/9', '/..%2f', '/a/b/c/d/e',
            ];
            for (let i = 0; i < 500; i++) {
                paths.push(`/junk${i}`, `/api/junk${i}`);
            }

            const labels = new Set(paths.map(normalizeRoute));

            expect(labels.size).toBeLessThanOrEqual(MAX_ROUTE_LABELS);
            // Known routes still resolve; only the unknown ones collapse.
            expect(labels).toContain('/api/health');
            expect(labels).toContain('other');
        });
    });
});
