import fs from 'node:fs/promises';
import path from 'node:path';
import { apiHandler } from '@/lib/apiHandler';

export const dynamic = 'force-dynamic';

const openApiPathCandidates = [
    path.resolve(process.cwd(), 'docs/api-reference/sourcebot-public.openapi.json'),
    path.resolve(process.cwd(), '../docs/api-reference/sourcebot-public.openapi.json'),
    path.resolve(process.cwd(), '../../docs/api-reference/sourcebot-public.openapi.json'),
];

async function loadOpenApiDocument() {
    for (const candidate of openApiPathCandidates) {
        try {
            return JSON.parse(await fs.readFile(candidate, 'utf8'));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }

    throw new Error('OpenAPI spec file not found');
}

export const GET = apiHandler(async () => {
    const document = await loadOpenApiDocument();

    return Response.json(document, {
        headers: {
            'Content-Type': 'application/vnd.oai.openapi+json;version=3.0.3',
        },
    });
}, { track: false });
