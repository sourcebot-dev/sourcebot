import { Client } from "typesense";
import { createLogger, env } from "@sourcebot/shared";
import { Repo } from "@sourcebot/db";

const logger = createLogger('typesense');

const REPO_COLLECTION = 'repos';
const FILE_COLLECTION = 'files';
const COMMIT_COLLECTION = 'commits';

interface RepoDocument {
    id: string; // "repo_ID"
    repo_id: number;
    name: string;
    organization: string;
    url: string;
    default_branch: string;
}

interface FileDocument {
    id: string; // "file_REPOID_PATHHASH"
    repo_id: number;
    path: string;
    filename: string;
    extension: string;
}

interface CommitDocument {
    id: string; // "commit_REPOID_HASH"
    repo_id: number;
    hash: string;
    short_hash: string;
    author_name: string;
    author_email: string;
    message: string;
    date: number; // Unix timestamp
}

export class TypesenseService {
    private client: Client;
    private initialized = false;

    constructor() {
        this.client = new Client({
            nodes: [{
                host: env.TYPESENSE_HOST || 'typesense',
                port: parseInt(env.TYPESENSE_PORT || '8108'),
                protocol: 'http'
            }],
            apiKey: env.TYPESENSE_API_KEY || 'xyz',
            connectionTimeoutSeconds: 5
        });
    }

    public async initialize() {
        if (this.initialized) return;

        try {
            await this.ensureCollections();
            this.initialized = true;
            logger.info("Typesense service initialized successfully");
        } catch (error) {
            logger.error("Failed to initialize Typesense service", error);
        }
    }

    private async ensureCollections() {
        const collections = await this.client.collections().retrieve();
        const names = collections.map(c => c.name);

        if (!names.includes(REPO_COLLECTION)) {
            await this.client.collections().create({
                name: REPO_COLLECTION,
                fields: [
                    { name: 'name', type: 'string' },
                    { name: 'organization', type: 'string', facet: true },
                    { name: 'repo_id', type: 'int32' },
                    { name: 'url', type: 'string' },
                ],
                default_sorting_field: 'repo_id'
            });
            logger.info(`Created collection: ${REPO_COLLECTION}`);
        }

        if (!names.includes(FILE_COLLECTION)) {
            await this.client.collections().create({
                name: FILE_COLLECTION,
                fields: [
                    { name: 'filename', type: 'string' },
                    { name: 'path', type: 'string' },
                    { name: 'repo_id', type: 'int32', facet: true },
                    { name: 'extension', type: 'string', facet: true },
                ]
            });
            logger.info(`Created collection: ${FILE_COLLECTION}`);
        }

        if (!names.includes(COMMIT_COLLECTION)) {
            await this.client.collections().create({
                name: COMMIT_COLLECTION,
                fields: [
                    { name: 'message', type: 'string' },
                    { name: 'author_name', type: 'string', facet: true },
                    { name: 'repo_id', type: 'int32', facet: true },
                    { name: 'date', type: 'int64', sort: true },
                    { name: 'hash', type: 'string' },
                ],
                default_sorting_field: 'date'
            });
            logger.info(`Created collection: ${COMMIT_COLLECTION}`);
        }
    }

    public async indexRepo(repo: Repo) {
        if (!this.initialized) await this.initialize();
        if (!this.initialized) return;

        const doc: RepoDocument = {
            id: `repo_${repo.id}`,
            repo_id: repo.id,
            name: repo.name,
            organization: repo.name.split('/')[0] || 'unknown', // simple heuristic
            url: repo.cloneUrl,
            default_branch: 'HEAD' // Placeholder
        };

        try {
            await this.client.collections(REPO_COLLECTION).documents().upsert(doc);
            logger.debug(`Indexed repo: ${repo.name}`);
        } catch (err) {
            logger.error(`Failed to index repo ${repo.name}`, err);
        }
    }

    public async indexFiles(repoId: number, filePaths: string[]) {
        if (!this.initialized) await this.initialize();
        if (!this.initialized) return;
        if (filePaths.length === 0) return;

        // Batch processing
        const batchSize = 1000;
        for (let i = 0; i < filePaths.length; i += batchSize) {
            const batch = filePaths.slice(i, i + batchSize);
            const docs: FileDocument[] = batch.map(path => {
                const parts = path.split('/');
                const filename = parts[parts.length - 1];
                const extParts = filename.split('.');
                const extension = extParts.length > 1 ? extParts[extParts.length - 1] : '';

                return {
                    id: `file_${repoId}_${Buffer.from(path).toString('base64')}`,
                    repo_id: repoId,
                    path: path,
                    filename: filename,
                    extension: extension
                };
            });

            try {
                await this.client.collections(FILE_COLLECTION).documents().import(docs, { action: 'upsert' });
                logger.debug(`Indexed ${batch.length} files for repo ${repoId}`);
            } catch (err) {
                logger.error(`Failed to batch index files for repo ${repoId}`, err);
            }
        }
    }

    public async indexCommits(repoId: number, commits: any[]) {
        if (!this.initialized) await this.initialize();
        if (!this.initialized) return;
        if (commits.length === 0) return;

        const docs: CommitDocument[] = commits.map(c => ({
            id: `commit_${repoId}_${c.hash}`,
            repo_id: repoId,
            hash: c.hash,
            short_hash: c.hash.substring(0, 7),
            author_name: c.author_name,
            author_email: c.author_email,
            message: c.message,
            date: c.date,
        }));

        try {
            await this.client.collections(COMMIT_COLLECTION).documents().import(docs, { action: 'upsert' });
            logger.debug(`Indexed ${commits.length} commits for repo ${repoId}`);
        } catch (err) {
            logger.error(`Failed to batch index commits for repo ${repoId}`, err);
        }
    }

    public async search(query: string, type: 'repo' | 'file' | 'commit' = 'repo', repoId?: number) {
        if (!this.initialized) await this.initialize();
        if (!this.initialized) throw new Error('Search service not available');

        let collection = REPO_COLLECTION;
        let queryBy = 'name,organization';
        if (type === 'file') {
            collection = FILE_COLLECTION;
            queryBy = 'filename,path';
        } else if (type === 'commit') {
            collection = COMMIT_COLLECTION;
            queryBy = 'message,author_name';
        }

        const searchParams: any = {
            q: query,
            query_by: queryBy,
            per_page: 20
        };

        if (repoId) {
            searchParams.filter_by = `repo_id:=${repoId}`;
        }

        return await this.client.collections(collection).documents().search(searchParams);
    }
}
