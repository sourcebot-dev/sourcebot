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
import type { SearchResultFile, StreamedSearchResponse } from './types';

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
                findMany: vi.fn().mockRejectedValue(new Error('database unavailable')),
            },
        } as unknown as PrismaClient;

        await expect(zoektSearch(searchRequest, prisma)).rejects.toThrow('database unavailable');
        expect(mocks.close).toHaveBeenCalledOnce();
    });

    test.each([1, 2])('batches %i repositories into one lookup for 100 files', async (repoCount) => {
        const files = Array.from({ length: 100 }, (_, index) => createFile(index % repoCount + 1));
        mocks.search.mockImplementation((_request, _metadata, callback) => {
            callback(null, { files });
        });
        const ids = Array.from({ length: repoCount }, (_, index) => index + 1);
        const findMany = vi.fn().mockResolvedValue(ids.toReversed().map(id => createRepo(id)));
        const prisma = { repo: { findMany } } as unknown as PrismaClient;

        const response = await zoektSearch(searchRequest, prisma);

        expect(findMany).toHaveBeenCalledExactlyOnceWith({ where: { id: { in: ids } } });
        expect(response.files).toHaveLength(100);
        expect(response.files.map(file => file.repositoryId)).toEqual(files.map(file => file.repository_id));
        expect(response.repositoryInfo.map(repo => repo.id)).toEqual(ids);
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
        const findMany = vi.fn().mockResolvedValue([]);
        const prisma = { repo: { findMany } } as unknown as PrismaClient;

        const response = await zoektSearch(searchRequest, prisma);

        expect(findMany).toHaveBeenCalledOnce();
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
        const findMany = vi.fn()
            .mockResolvedValueOnce([createRepo(2, 'repo-2'), createRepo(1, 'repo-1')])
            .mockResolvedValueOnce([createRepo(3, 'repo-3')]);
        const prisma = { repo: { findMany } } as unknown as PrismaClient;
        const stream = await zoektStreamSearch(searchRequest, prisma);
        const reader = stream.getReader();

        for (const ids of [[1, 1, 2, 2], [1, 2, 3, 3]]) {
            grpcStream.emit('data', { response_chunk: { files: ids.map(id => createFile(id)) } });
            const chunk = await reader.read();
            const response = JSON.parse(new TextDecoder().decode(chunk.value).slice('data: '.length)) as Extract<StreamedSearchResponse, { type: 'chunk' }>;
            expect(response.files.map(file => file.repositoryId)).toEqual(ids);
            expect(response.repositoryInfo.map(repo => repo.id)).toEqual([...new Set(ids)]);
            for (const file of response.files) {
                expect(response.repositoryInfo.find(repo => repo.id === file.repositoryId)?.name).toBe(file.repository);
                expect(file.repository).toBe(`repo-${file.repositoryId}`);
            }
        }

        expect(findMany).toHaveBeenCalledTimes(2);
        expect(findMany).toHaveBeenNthCalledWith(1, { where: { id: { in: [1, 2] } } });
        expect(findMany).toHaveBeenNthCalledWith(2, { where: { id: { in: [3] } } });
        grpcStream.emit('end');
        while (!(await reader.read()).done) {
            // Drain the final statistics and completion marker.
        }
        expect(mocks.close).toHaveBeenCalledOnce();
    });

    test('keeps missing IDs and legacy names cached only for the current stream', async () => {
        const findMany = vi.fn().mockResolvedValue([createRepo(2, 'visible-repo')]);
        const findFirst = vi.fn().mockResolvedValue(null);
        const prisma = { repo: { findMany, findFirst } } as unknown as PrismaClient;
        const files = [createFile(1), createFile(undefined, 'missing-repo'), createFile(2)];

        for (let request = 0; request < 2; request++) {
            const grpcStream = Object.assign(new EventEmitter(), {
                pause: vi.fn(),
                resume: vi.fn(),
                cancel: vi.fn(),
            });
            mocks.streamSearch.mockReturnValue(grpcStream);
            const reader = (await zoektStreamSearch(searchRequest, prisma)).getReader();
            for (let chunk = 0; chunk < 2; chunk++) {
                grpcStream.emit('data', { response_chunk: { files } });
                const result = await reader.read();
                const response = JSON.parse(new TextDecoder().decode(result.value).slice('data: '.length));
                expect(response.files.map((file: SearchResultFile) => file.repositoryId)).toEqual([2]);
                expect(response.repositoryInfo).toEqual([expect.objectContaining({ id: 2, name: 'visible-repo' })]);
            }
            grpcStream.emit('end');
            while (!(await reader.read()).done) {
                // Drain the final statistics and completion marker.
            }
        }

        expect(findMany).toHaveBeenCalledTimes(2);
        expect(findMany).toHaveBeenCalledWith({ where: { id: { in: [1, 2] } } });
        expect(findFirst).toHaveBeenCalledTimes(2);
        expect(findFirst).toHaveBeenCalledWith({ where: { name: 'missing-repo' } });
    });

    test('keeps numeric IDs separate from legacy names in mixed shards', async () => {
        const files = [createFile(1), createFile(undefined, '1'), createFile(1), createFile(undefined, '1')];
        mocks.search.mockImplementation((_request, _metadata, callback) => {
            callback(null, { files });
        });
        const findMany = vi.fn().mockResolvedValue([createRepo(1, 'numeric-repo')]);
        const findFirst = vi.fn().mockResolvedValue(createRepo(2, '1'));
        const prisma = { repo: { findMany, findFirst } } as unknown as PrismaClient;

        const response = await zoektSearch(searchRequest, prisma);

        expect(response.files.map(file => file.repositoryId)).toEqual([1, 2, 1, 2]);
        expect(response.repositoryInfo.map(repo => repo.name)).toEqual(['numeric-repo', '1']);
        expect(findMany).toHaveBeenCalledExactlyOnceWith({ where: { id: { in: [1] } } });
        expect(findFirst).toHaveBeenCalledExactlyOnceWith({ where: { name: '1' } });
    });
});
