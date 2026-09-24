import type { PrismaClient } from '@sourcebot/db';
import type { SearchRequest as ZoektGrpcSearchRequest } from '@/proto/zoekt/webserver/v1/SearchRequest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const mocks = vi.hoisted(() => {
    const close = vi.fn();
    const search = vi.fn();
    const streamSearch = vi.fn();

    class WebserverService {
        Search = search;
        StreamSearch = streamSearch;
        close = close;
    }

    return {
        close,
        loadSync: vi.fn(() => ({})),
        search,
        streamSearch,
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

import { zoektSearch, zoektStreamSearch } from './zoektSearcher';

const searchRequest = {} as ZoektGrpcSearchRequest;

const createFile = (id: number | undefined, repository = 'github.com/org/repo') => ({
    repository_id: id,
    repository,
    file_name: Buffer.from('src/index.ts'),
    chunk_matches: [],
    branches: ['main'],
    language: 'TypeScript',
});

const createRepo = (id: number, name = 'github.com/org/repo') => ({
    id,
    name,
    displayName: name,
    webUrl: null,
    external_codeHostType: 'github',
});

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

    test.each([1, 2])('looks up each of %i repositories only once for 100 files', async (repoCount) => {
        const files = Array.from({ length: 100 }, (_, index) => createFile(index % repoCount + 1));
        mocks.search.mockImplementation((_request, _metadata, callback) => {
            callback(null, { files });
        });
        const findUnique = vi.fn(async ({ where: { id } }) => createRepo(id));
        const prisma = { repo: { findUnique } } as unknown as PrismaClient;

        const response = await zoektSearch(searchRequest, prisma);

        expect(findUnique).toHaveBeenCalledTimes(repoCount);
        expect(response.files).toHaveLength(100);
        expect(response.files.map(file => file.repositoryId)).toEqual(files.map(file => file.repository_id));
        expect(response.repositoryInfo).toHaveLength(repoCount);
    });

    test('deduplicates lookups by name for legacy shards without repository IDs', async () => {
        mocks.search.mockImplementation((_request, _metadata, callback) => {
            callback(null, { files: Array.from({ length: 100 }, () => createFile(undefined)) });
        });
        const findFirst = vi.fn().mockResolvedValue(createRepo(1));
        const prisma = { repo: { findFirst } } as unknown as PrismaClient;

        const response = await zoektSearch(searchRequest, prisma);

        expect(findFirst).toHaveBeenCalledExactlyOnceWith({ where: { name: 'github.com/org/repo' } });
        expect(response.files).toHaveLength(100);
    });

    test('looks up a missing repository once and omits its files', async () => {
        mocks.search.mockImplementation((_request, _metadata, callback) => {
            callback(null, { files: Array.from({ length: 100 }, () => createFile(1)) });
        });
        const findUnique = vi.fn().mockResolvedValue(null);
        const prisma = { repo: { findUnique } } as unknown as PrismaClient;

        const response = await zoektSearch(searchRequest, prisma);

        expect(findUnique).toHaveBeenCalledOnce();
        expect(response.files).toEqual([]);
        expect(response.repositoryInfo).toEqual([]);
    });

    test('deduplicates streaming chunks and reuses repository metadata across chunks', async () => {
        const grpcStream = Object.assign(new EventEmitter(), {
            pause: vi.fn(),
            resume: vi.fn(),
            cancel: vi.fn(),
        });
        mocks.streamSearch.mockReturnValue(grpcStream);
        const findUnique = vi.fn(async ({ where: { id } }) => createRepo(id));
        const prisma = { repo: { findUnique } } as unknown as PrismaClient;
        const stream = await zoektStreamSearch(searchRequest, prisma);
        const reader = stream.getReader();

        for (const ids of [[1, 1, 2, 2], [1, 2, 3, 3]]) {
            grpcStream.emit('data', { response_chunk: { files: ids.map(id => createFile(id)) } });
            const chunk = await reader.read();
            const response = JSON.parse(new TextDecoder().decode(chunk.value).slice('data: '.length));
            expect(response.files).toHaveLength(ids.length);
            expect(response.repositoryInfo).toHaveLength(new Set(ids).size);
        }

        expect(findUnique).toHaveBeenCalledTimes(3);
        grpcStream.emit('end');
        while (!(await reader.read()).done) {
            // Drain the final statistics and completion marker.
        }
        expect(mocks.close).toHaveBeenCalledOnce();
    });
});
