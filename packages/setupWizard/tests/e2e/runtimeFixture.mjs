// Executed inside a disposable Sourcebot image. The repository entrypoint, real
// curl, jq and uuidgen are unchanged; only DB migration/supervisor are replaced.
import { createServer } from 'node:https';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
const root = mkdtempSync('/tmp/entrypoint-fixture-');
writeFileSync(`${root}/yarn`, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
writeFileSync(`${root}/supervisord`, '#!/bin/sh\nprintf "%s" "$SOURCEBOT_INSTALL_ID" > "$TEST_ID_RESULT"\n', { mode: 0o755 });
const events = [];
const server = createServer({ key: readFileSync('/fixture/key.pem'), cert: readFileSync('/fixture/cert.pem') }, async (req, res) => {
    const parts = [];
    for await (const part of req) {
        parts.push(part);
    }
    events.push(JSON.parse(Buffer.concat(parts).toString()));
    res.writeHead(200).end('{"status":1}');
}).listen(443, '127.0.0.1');
await once(server, 'listening');
try {
    const env = { ...process.env, PATH: `${root}:${process.env.PATH}`, CONFIG_PATH: '', DATA_CACHE_DIR: '/data', DATABASE_URL: 'postgresql://fixture', REDIS_URL: 'redis://fixture', CURL_CA_BUNDLE: '/fixture/cert.pem', TEST_ID_RESULT: `${root}/id` };
    if (env.TEST_OMIT_INSTALL_ID === 'true') {
        delete env.SOURCEBOT_INSTALL_ID;
    }
    const child = spawn('/bin/sh', ['/fixture/entrypoint.sh'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let diagnostics = '';
    child.stdout.on('data', b => { diagnostics += b; });
    child.stderr.on('data', b => { diagnostics += b; });
    const [code] = await once(child, 'close');
    if (code !== 0) {
        throw Error(`Entrypoint failed (${code}): ${diagnostics}`);
    }
    console.log(JSON.stringify({ events, installId: readFileSync(`${root}/id`, 'utf8'), persisted: JSON.parse(readFileSync('/data/.installedv3', 'utf8')) }));
} finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
}
