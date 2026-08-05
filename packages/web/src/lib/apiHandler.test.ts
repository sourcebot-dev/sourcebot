import { describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { apiHandler } from './apiHandler';
import { getCurrentRequest } from './requestContext';

vi.mock('./posthog', () => ({
    captureEvent: vi.fn(),
}));

describe('apiHandler', () => {
    test('stores the current request while the handler runs', async () => {
        const request = new NextRequest('https://sourcebot.example.com/api/test', {
            method: 'POST',
        });

        const handler = apiHandler(async (_request: NextRequest) => {
            expect(getCurrentRequest()).toBe(request);
            await Promise.resolve();
            expect(getCurrentRequest()).toBe(request);

            return new Response(null, { status: 204 });
        });

        const response = await handler(request);

        expect(response.status).toBe(204);
        expect(getCurrentRequest()).toBeUndefined();
    });
});
