import { describe, expect, test } from 'vitest';
import { buildQueryExampleHref } from './searchLandingPageUtils';

describe('buildQueryExampleHref', () => {
    test('encodes reserved query characters in example links', () => {
        const href = buildQueryExampleHref({
            query: 'foo & bar#baz%qux',
        });

        const url = new URL(href, 'https://sourcebot.local');

        expect(url.pathname).toBe('/search');
        expect(url.searchParams.get('query')).toBe('foo & bar#baz%qux');
    });

    test('preserves the case sensitivity flag when enabled', () => {
        const href = buildQueryExampleHref({
            query: 'TODO',
            isCaseSensitivityEnabled: true,
        });

        const url = new URL(href, 'https://sourcebot.local');

        expect(url.searchParams.get('query')).toBe('TODO');
        expect(url.searchParams.get('isCaseSensitivityEnabled')).toBe('true');
    });
});
