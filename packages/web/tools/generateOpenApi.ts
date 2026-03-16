import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCEBOT_VERSION } from '../../shared/src/version.js';
import { createPublicOpenApiDocument } from '../src/openapi/publicApiDocument.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const outputPath = path.join(repoRoot, 'docs', 'api-reference', 'sourcebot-public.openapi.json');

async function main() {
    const document = createPublicOpenApiDocument(SOURCEBOT_VERSION);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

    process.stdout.write(`Wrote OpenAPI spec to ${outputPath}\n`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
