import { describe, expect, it } from 'vitest';
import { normalizeRoute } from './httpMetrics';

describe('normalizeRoute', () => {
    it('maps the root path', () => {
        expect(normalizeRoute('/')).toBe('/');
        expect(normalizeRoute('')).toBe('/');
    });

    it('keeps two segments for API routes', () => {
        expect(normalizeRoute('/api/health')).toBe('/api/health');
        expect(normalizeRoute('/api/commits')).toBe('/api/commits');
        expect(normalizeRoute('/api/auth/callback/github')).toBe('/api/auth');
    });

    it('keeps one segment for page routes', () => {
        expect(normalizeRoute('/search')).toBe('/search');
        expect(normalizeRoute('/settings/connections/42')).toBe('/settings');
    });

    it('bounds unbounded repository and file paths', () => {
        const a = normalizeRoute('/browse/github.com/org/repo/-/blob/src/index.ts');
        const b = normalizeRoute('/browse/github.com/other/repo/-/blob/lib/other.ts');

        expect(a).toBe('/browse');
        expect(b).toBe('/browse');
        // The point of normalizing: distinct files must not mint distinct labels.
        expect(a).toBe(b);
    });

    it('is unaffected by trailing or duplicate slashes', () => {
        expect(normalizeRoute('/search/')).toBe('/search');
        expect(normalizeRoute('//search//')).toBe('/search');
    });

    it('produces a bounded label set for a realistic path mix', () => {
        const paths = [
            '/', '/search', '/search?q=foo'.split('?')[0], '/repos', '/settings/general',
            '/browse/github.com/a/b/-/blob/x.ts', '/browse/github.com/c/d/-/blob/y.ts',
            '/api/health', '/api/health', '/api/commits', '/api/auth/session',
            '/_next/static/chunks/main.js', '/_next/static/css/app.css',
        ];

        const labels = new Set(paths.map(normalizeRoute));

        expect(labels).toEqual(new Set([
            '/', '/search', '/repos', '/settings', '/browse',
            '/api/health', '/api/commits', '/api/auth', '/_next',
        ]));
    });
});
