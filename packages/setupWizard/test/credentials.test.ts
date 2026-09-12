import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateCredentialPath } from '../src/models.js';
import {
    GOOGLE_APPLICATION_CREDENTIALS_CONTAINER_PATH,
    readOnlyBindMount,
} from '../src/utils.js';

test('credential path validation requires a readable file', () => {
    const root = mkdtempSync(join(tmpdir(), 'setup-sourcebot-credentials-'));
    const credentialFile = join(root, 'service account.json');
    writeFileSync(credentialFile, '{}');

    try {
        assert.equal(validateCredentialPath(''), 'Credentials path is required');
        assert.equal(validateCredentialPath(join(root, 'missing.json')), 'Credentials file must exist and be readable');
        assert.equal(validateCredentialPath(root), 'Credentials file must exist and be readable');
        assert.equal(validateCredentialPath(credentialFile), true);

        chmodSync(credentialFile, 0o000);
        assert.equal(validateCredentialPath(credentialFile), 'Credentials file must exist and be readable');
    } finally {
        chmodSync(credentialFile, 0o644);
        rmSync(root, { recursive: true, force: true });
    }
});

test('read-only bind mounts preserve special host paths and the container target', () => {
    const source = '/tmp/repos with spaces/#root/service account "vertex".json';
    assert.deepEqual(readOnlyBindMount(source, GOOGLE_APPLICATION_CREDENTIALS_CONTAINER_PATH), [
        '      - type: bind',
        `        source: ${JSON.stringify(source)}`,
        `        target: ${JSON.stringify(GOOGLE_APPLICATION_CREDENTIALS_CONTAINER_PATH)}`,
        '        read_only: true',
    ]);
});
