import { NextRequest } from 'next/server';
import { describe, expect, test } from 'vitest';
import { proxy } from './proxy';

describe('proxy', () => {
    test.each([
        'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
        'Mozilla/5.0 (compatible; META-EXTERNALAGENT/1.1)',
    ])('blocks the disallowed Meta crawler before rendering', async (userAgent) => {
        const response = await proxy(new NextRequest('https://sourcebot.example/browse/github.com/sourcebot-dev/sourcebot', {
            headers: {
                'user-agent': userAgent,
            },
        }));

        expect(response.status).toBe(403);
        await expect(response.text()).resolves.toBe('Crawler access is disallowed.');
    });

    test('allows ordinary browser requests through', async () => {
        const response = await proxy(new NextRequest('https://sourcebot.example/browse/github.com/sourcebot-dev/sourcebot', {
            headers: {
                'user-agent': 'Mozilla/5.0 Chrome/145.0.0.0',
            },
        }));

        expect(response.status).toBe(200);
        expect(response.headers.get('x-middleware-next')).toBe('1');
    });

    test('preserves the legacy organization-prefix redirect', async () => {
        const response = await proxy(new NextRequest('https://sourcebot.example/~/search'));

        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toBe('https://sourcebot.example/search');
    });
});
