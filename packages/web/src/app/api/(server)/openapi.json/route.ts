import fs from 'node:fs/promises';
import path from 'node:path';
import { apiHandler } from '@/lib/apiHandler';

export const dynamic = 'force-dynamic';

async function loadOpenApiDocument() {
    const openApiPath = path.resolve(process.cwd(), '../../docs/api-reference/sourcebot-public.openapi.json');
    try {
        return JSON.parse(await fs.readFile(openApiPath, 'utf8'));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }
}

export const GET = apiHandler(async () => {
    const document = await loadOpenApiDocument();

    return Response.json(document, {
        headers: {
            'Content-Type': 'application/vnd.oai.openapi+json;version=3.0.3',
        },
    });
}, { track: false });
