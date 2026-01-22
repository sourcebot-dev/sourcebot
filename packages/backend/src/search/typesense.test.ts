import { TypesenseService } from './typesense';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock typesense client
vi.mock('typesense', () => {
    return {
        Client: vi.fn().mockImplementation(() => ({
            collections: vi.fn().mockReturnThis(),
            retrieve: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue({}),
            documents: vi.fn().mockReturnThis(),
            upsert: vi.fn().mockResolvedValue({}),
            import: vi.fn().mockResolvedValue([]),
            search: vi.fn().mockResolvedValue({ hits: [] }),
        }))
    };
});

// Mock shared env
vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
    env: {
        TYPESENSE_HOST: 'localhost',
        TYPESENSE_PORT: '8108',
        TYPESENSE_API_KEY: 'xyz'
    }
}));

describe('TypesenseService', () => {
    let service: TypesenseService;
    let mockClient: any;

    beforeEach(() => {
        // Clear all mocks
        vi.clearAllMocks();
        service = new TypesenseService();
        mockClient = (service as any).client;
    });

    it('should initialize and create collections if they do not exist', async () => {
        // Mock retrieve to return empty array (no collections exist)
        mockClient.collections().retrieve.mockResolvedValue([]);

        await service.initialize();

        expect(mockClient.collections().create).toHaveBeenCalledTimes(3);
        expect(mockClient.collections().create).toHaveBeenCalledWith(expect.objectContaining({ name: 'repos' }));
        expect(mockClient.collections().create).toHaveBeenCalledWith(expect.objectContaining({ name: 'files' }));
        expect(mockClient.collections().create).toHaveBeenCalledWith(expect.objectContaining({ name: 'commits' }));
    });

    it('should not create collections if they already exist', async () => {
        // Mock retrieve to return existing collections
        mockClient.collections().retrieve.mockResolvedValue([
            { name: 'repos' },
            { name: 'files' },
            { name: 'commits' }
        ]);

        await service.initialize();

        expect(mockClient.collections().create).not.toHaveBeenCalled();
    });

    it('should index a repo', async () => {
        const repo: any = {
            id: 1,
            name: 'org/repo',
            cloneUrl: 'https://github.com/org/repo.git'
        };

        await service.indexRepo(repo);

        expect(mockClient.collections).toHaveBeenCalledWith('repos');
        expect(mockClient.documents).toHaveBeenCalled();
        expect(mockClient.upsert).toHaveBeenCalledWith(expect.objectContaining({
            id: 'repo_1',
            repo_id: 1,
            name: 'org/repo',
            organization: 'org'
        }));
    });

    it('should index files in batches', async () => {
        const filePaths = ['src/index.ts', 'package.json'];
        await service.indexFiles(1, filePaths);

        expect(mockClient.collections).toHaveBeenCalledWith('files');
        expect(mockClient.import).toHaveBeenCalledWith([
            expect.objectContaining({ filename: 'index.ts', path: 'src/index.ts', extension: 'ts' }),
            expect.objectContaining({ filename: 'package.json', path: 'package.json', extension: 'json' })
        ], { action: 'upsert' });
    });

    it('should index commits', async () => {
        const commits = [{
            hash: 'abc1234',
            message: 'feat: typesense',
            author_name: 'Dev',
            author_email: 'dev@example.com',
            date: 1234567890
        }];

        await service.indexCommits(1, commits);

        expect(mockClient.collections).toHaveBeenCalledWith('commits');
        expect(mockClient.import).toHaveBeenCalledWith([
            expect.objectContaining({
                id: 'commit_1_abc1234',
                hash: 'abc1234',
                message: 'feat: typesense'
            })
        ], { action: 'upsert' });
    });

    it('should search repos', async () => {
        await service.search('query', 'repo');

        expect(mockClient.collections).toHaveBeenCalledWith('repos');
        expect(mockClient.search).toHaveBeenCalledWith(expect.objectContaining({
            q: 'query',
            query_by: 'name,organization'
        }));
    });

    it('should search files with repoId filter', async () => {
        await service.search('query', 'file', 123);

        expect(mockClient.collections).toHaveBeenCalledWith('files');
        expect(mockClient.search).toHaveBeenCalledWith(expect.objectContaining({
            q: 'query',
            query_by: 'filename,path',
            filter_by: 'repo_id:=123'
        }));
    });
});
