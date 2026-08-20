import type { PrismaClient } from '@sourcebot/db';
import type { SearchRequest as ZoektGrpcSearchRequest } from '@/proto/zoekt/webserver/v1/SearchRequest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const close = vi.fn();
    const search = vi.fn();

    class WebserverService {
        Search = search;
        close = close;
    }

    return {
        close,
        loadSync: vi.fn(() => ({})),
        search,
        WebserverService,
    };
});

vi.mock('@grpc/proto-loader', () => ({
    loadSync: mocks.loadSync,
}));

vi.mock('@grpc/grpc-js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@grpc/grpc-js')>();
    return {
        ...actual,
        loadPackageDefinition: vi.fn(() => ({
            zoekt: {
                webserver: {
                    v1: {
                        WebserverService: mocks.WebserverService,
                    },
                },
            },
        })),
    };
});

vi.mock('@sentry/nextjs', () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    }),
    env: {
        AUTH_URL: 'http://sourcebot.test',
        ZOEKT_WEBSERVER_URL: 'http://zoekt:6070',
    },
}));

vi.mock('@/lib/posthog', () => ({
    captureEvent: vi.fn(),
}));

import { zoektSearch } from './zoektSearcher';

const searchRequest = {} as ZoektGrpcSearchRequest;

describe('zoektSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('closes its gRPC client after a successful unary search', async () => {
        mocks.search.mockImplementation((_request, _metadata, callback) => {
            callback(null, { files: [] });
        });

        const response = await zoektSearch(searchRequest, {} as PrismaClient);

        expect(response.files).toEqual([]);
        expect(mocks.close).toHaveBeenCalledOnce();
    });

    test('closes its gRPC client when the unary search fails', async () => {
        mocks.search.mockImplementation((_request, _metadata, callback) => {
            callback({ details: 'zoekt unavailable' });
        });

        await expect(zoektSearch(searchRequest, {} as PrismaClient)).rejects.toThrow();
        expect(mocks.close).toHaveBeenCalledOnce();
    });

    test('closes its gRPC client when response transformation fails', async () => {
        mocks.search.mockImplementation((_request, _metadata, callback) => {
            callback(null, {
                files: [{ repository_id: 1 }],
            });
        });
        const prisma = {
            repo: {
                findUnique: vi.fn().mockRejectedValue(new Error('database unavailable')),
            },
        } as unknown as PrismaClient;

        await expect(zoektSearch(searchRequest, prisma)).rejects.toThrow('database unavailable');
        expect(mocks.close).toHaveBeenCalledOnce();
    });
});
