import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import type { ZodTypeAny } from 'zod';
import type { SchemaObject } from 'openapi3-ts/oas30';
import {
    publicFileSourceRequestSchema,
    publicFileSourceResponseSchema,
    publicGetFilesRequestSchema,
    publicGetFilesResponseSchema,
    publicGetTreeRequestSchema,
    publicListReposQuerySchema,
    publicListReposResponseSchema,
    publicSearchRequestSchema,
    publicSearchResponseSchema,
    publicServiceErrorSchema,
    publicStreamSearchSseSchema,
    publicVersionResponseSchema,
} from './publicApiSchemas.js';

const searchTag = { name: 'Search', description: 'Code search endpoints.' };
const reposTag = { name: 'Repositories', description: 'Repository listing and metadata endpoints.' };
const filesTag = { name: 'Files', description: 'File tree, file listing, and file content endpoints.' };
const miscTag = { name: 'Misc', description: 'Miscellaneous public API endpoints.' };

const publicFileTreeNodeSchema: SchemaObject = {
    type: 'object',
    properties: {
        type: { type: 'string' },
        path: { type: 'string' },
        name: { type: 'string' },
        children: {
            type: 'array',
            items: { $ref: '#/components/schemas/PublicFileTreeNode' },
        },
    },
    required: ['type', 'path', 'name', 'children'],
    additionalProperties: false,
};

const publicGetTreeResponseSchema: SchemaObject = {
    type: 'object',
    properties: {
        tree: { $ref: '#/components/schemas/PublicFileTreeNode' },
    },
    required: ['tree'],
    additionalProperties: false,
};

function jsonContent(schema: ZodTypeAny | SchemaObject) {
    return {
        'application/json': {
            schema,
        },
    };
}

function errorJson(description: string) {
    return {
        description,
        content: jsonContent(publicServiceErrorSchema),
    };
}

export function createPublicOpenApiDocument(version: string) {
    const registry = new OpenAPIRegistry();

    registry.registerPath({
        method: 'post',
        path: '/api/search',
        tags: [searchTag.name],
        summary: 'Run a blocking code search',
        request: {
            body: {
                required: true,
                content: jsonContent(publicSearchRequestSchema),
            },
        },
        responses: {
            200: {
                description: 'Search results.',
                content: jsonContent(publicSearchResponseSchema),
            },
            400: errorJson('Invalid request body.'),
            500: errorJson('Unexpected search failure.'),
        },
    });

    registry.registerPath({
        method: 'post',
        path: '/api/stream_search',
        tags: [searchTag.name],
        summary: 'Run a streaming code search',
        description: 'Returns a server-sent event stream. Each event data payload is a JSON object describing either a chunk, final summary, or error.',
        request: {
            body: {
                required: true,
                content: jsonContent(publicSearchRequestSchema),
            },
        },
        responses: {
            200: {
                description: 'SSE stream of search results.',
                content: {
                    'text/event-stream': {
                        schema: publicStreamSearchSseSchema,
                    },
                },
            },
            400: errorJson('Invalid request body.'),
            500: errorJson('Unexpected search failure.'),
        },
    });

    registry.registerPath({
        method: 'get',
        path: '/api/repos',
        tags: [reposTag.name],
        summary: 'List repositories',
        request: {
            query: publicListReposQuerySchema,
        },
        responses: {
            200: {
                description: 'Paginated repository list.',
                headers: {
                    'X-Total-Count': {
                        description: 'Total number of repositories matching the query across all pages.',
                        schema: {
                            type: 'integer',
                            example: 137,
                        },
                    },
                    Link: {
                        description: 'Pagination links formatted per RFC 8288. Includes `rel=\"next\"`, `rel=\"prev\"`, `rel=\"first\"`, and `rel=\"last\"` when applicable.',
                        schema: {
                            type: 'string',
                            example: '</api/repos?page=2&perPage=30>; rel="next", </api/repos?page=5&perPage=30>; rel="last"',
                        },
                    },
                },
                content: jsonContent(publicListReposResponseSchema),
            },
            400: errorJson('Invalid query parameters.'),
            500: errorJson('Unexpected repository listing failure.'),
        },
    });

    registry.registerPath({
        method: 'get',
        path: '/api/version',
        tags: [miscTag.name],
        summary: 'Get Sourcebot version',
        responses: {
            200: {
                description: 'Current Sourcebot version.',
                content: jsonContent(publicVersionResponseSchema),
            },
        },
    });

    registry.registerPath({
        method: 'get',
        path: '/api/source',
        tags: [filesTag.name],
        summary: 'Get file contents',
        request: {
            query: publicFileSourceRequestSchema,
        },
        responses: {
            200: {
                description: 'File source and metadata.',
                content: jsonContent(publicFileSourceResponseSchema),
            },
            400: errorJson('Invalid query parameters or git ref.'),
            404: errorJson('Repository or file not found.'),
            500: errorJson('Unexpected file retrieval failure.'),
        },
    });

    registry.registerPath({
        method: 'post',
        path: '/api/tree',
        tags: [filesTag.name],
        summary: 'Get a file tree',
        request: {
            body: {
                required: true,
                content: jsonContent(publicGetTreeRequestSchema),
            },
        },
        responses: {
            200: {
                description: 'File tree for the requested repository revision.',
                content: jsonContent(publicGetTreeResponseSchema),
            },
            400: errorJson('Invalid request body or git ref.'),
            404: errorJson('Repository or path not found.'),
            500: errorJson('Unexpected tree retrieval failure.'),
        },
    });

    registry.registerPath({
        method: 'post',
        path: '/api/files',
        tags: [filesTag.name],
        summary: 'List files in a repository revision',
        request: {
            body: {
                required: true,
                content: jsonContent(publicGetFilesRequestSchema),
            },
        },
        responses: {
            200: {
                description: 'Flat list of files in the requested repository revision.',
                content: jsonContent(publicGetFilesResponseSchema),
            },
            400: errorJson('Invalid request body.'),
            404: errorJson('Repository not found.'),
            500: errorJson('Unexpected file listing failure.'),
        },
    });

    const generator = new OpenApiGeneratorV3(registry.definitions);

    const document = generator.generateDocument({
        openapi: '3.0.3',
        info: {
            title: 'Sourcebot Public API',
            version,
            description: 'OpenAPI description for the public Sourcebot REST endpoints used for search, repository listing, and file browsing.',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Local development web app',
            },
        ],
        tags: [searchTag, reposTag, filesTag, miscTag],
    });

    document.components = document.components ?? {};
    document.components.schemas = {
        ...(document.components.schemas ?? {}),
        PublicFileTreeNode: publicFileTreeNodeSchema,
    };

    return document;
}
