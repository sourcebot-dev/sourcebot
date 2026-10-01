import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const mocks = vi.hoisted(() => ({
    getSecret: vi.fn(),
    secretClientConstructor: vi.fn(),
    defaultAzureCredentialConstructor: vi.fn(),
}));

// env.server.js imports crypto.js and loads the config at import time.
vi.mock('./env.server.js', () => ({
    env: {},
}));

vi.mock('@azure/identity', () => ({
    DefaultAzureCredential: class {
        constructor() {
            mocks.defaultAzureCredentialConstructor();
        }
    },
}));

vi.mock('@azure/keyvault-secrets', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@azure/keyvault-secrets')>();
    return {
        parseKeyVaultSecretIdentifier: actual.parseKeyVaultSecretIdentifier,
        SecretClient: class {
            constructor(vaultUrl: string) {
                mocks.secretClientConstructor(vaultUrl);
            }
            getSecret = mocks.getSecret;
        },
    };
});

import type { Token } from '@sourcebot/schemas/v3/shared.type';
import { getTokenFromConfig } from './crypto.js';

describe('getTokenFromConfig', () => {
    describe('env', () => {
        afterEach(() => {
            delete process.env.TEST_TOKEN;
        });

        test('returns the trimmed value of the environment variable', async () => {
            process.env.TEST_TOKEN = '  env-token\n';
            await expect(getTokenFromConfig({ env: 'TEST_TOKEN' })).resolves.toBe('env-token');
        });

        test('throws when the environment variable is not set', async () => {
            await expect(getTokenFromConfig({ env: 'TEST_TOKEN' })).rejects.toThrow('Environment variable TEST_TOKEN not found.');
        });
    });

    describe('file', () => {
        let tmpDir: string;

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sourcebot-token-'));
        });

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        test('returns the trimmed contents of the file', async () => {
            const tokenPath = path.join(tmpDir, 'token');
            fs.writeFileSync(tokenPath, 'ghs_file-token\n');

            await expect(getTokenFromConfig({ file: tokenPath })).resolves.toBe('ghs_file-token');
        });

        test('re-reads the file on every call so rotated tokens are picked up', async () => {
            const tokenPath = path.join(tmpDir, 'token');
            fs.writeFileSync(tokenPath, 'ghs_first');
            await expect(getTokenFromConfig({ file: tokenPath })).resolves.toBe('ghs_first');

            fs.writeFileSync(tokenPath, 'ghs_second');
            await expect(getTokenFromConfig({ file: tokenPath })).resolves.toBe('ghs_second');
        });

        test('throws when the file does not exist', async () => {
            const tokenPath = path.join(tmpDir, 'missing');

            await expect(getTokenFromConfig({ file: tokenPath })).rejects.toThrow(`Failed to read token file ${tokenPath}`);
        });

        test('throws when the file is empty', async () => {
            const tokenPath = path.join(tmpDir, 'token');
            fs.writeFileSync(tokenPath, ' \n');

            await expect(getTokenFromConfig({ file: tokenPath })).rejects.toThrow(`Token file ${tokenPath} is empty.`);
        });
    });

    describe('azureKeyVaultSecret', () => {
        beforeEach(() => {
            mocks.getSecret.mockReset();
            mocks.secretClientConstructor.mockReset();
        });

        test('fetches the latest version when no version is given', async () => {
            mocks.getSecret.mockResolvedValue({ value: 'kv-token\n' });

            const result = await getTokenFromConfig({ azureKeyVaultSecret: 'https://latest-vault.vault.azure.net/secrets/github-token' });

            expect(result).toBe('kv-token');
            expect(mocks.secretClientConstructor).toHaveBeenCalledWith('https://latest-vault.vault.azure.net');
            expect(mocks.getSecret).toHaveBeenCalledWith('github-token', { version: undefined });
        });

        test('fetches a specific version when one is given', async () => {
            mocks.getSecret.mockResolvedValue({ value: 'kv-token' });

            await getTokenFromConfig({ azureKeyVaultSecret: 'https://versioned-vault.vault.azure.net/secrets/github-token/0123abcd' });

            expect(mocks.getSecret).toHaveBeenCalledWith('github-token', { version: '0123abcd' });
        });

        test('reuses the client for the same vault and does not cache the secret value', async () => {
            mocks.getSecret
                .mockResolvedValueOnce({ value: 'kv-first' })
                .mockResolvedValueOnce({ value: 'kv-second' });
            const token = { azureKeyVaultSecret: 'https://cached-vault.vault.azure.net/secrets/github-token' };

            await expect(getTokenFromConfig(token)).resolves.toBe('kv-first');
            await expect(getTokenFromConfig(token)).resolves.toBe('kv-second');

            expect(mocks.secretClientConstructor).toHaveBeenCalledTimes(1);
            expect(mocks.getSecret).toHaveBeenCalledTimes(2);
        });

        test('throws when the secret has no value', async () => {
            mocks.getSecret.mockResolvedValue({ value: undefined });
            const id = 'https://empty-vault.vault.azure.net/secrets/github-token';

            await expect(getTokenFromConfig({ azureKeyVaultSecret: id })).rejects.toThrow(`Failed to access Azure Key Vault secret ${id}: Secret ${id} has no value.`);
        });

        test('wraps errors from Key Vault', async () => {
            mocks.getSecret.mockRejectedValue(new Error('Forbidden'));
            const id = 'https://forbidden-vault.vault.azure.net/secrets/github-token';

            await expect(getTokenFromConfig({ azureKeyVaultSecret: id })).rejects.toThrow(`Failed to access Azure Key Vault secret ${id}: Forbidden`);
        });

        test.each([
            'not-a-url',
            'https://my-vault.vault.azure.net/keys/github-token',
            'https://my-vault.vault.azure.net/secrets/',
            'http://my-vault.vault.azure.net/secrets/github-token',
        ])('rejects malformed identifier %s without calling Key Vault', async (id) => {
            await expect(getTokenFromConfig({ azureKeyVaultSecret: id })).rejects.toThrow('Expected the format');
            expect(mocks.getSecret).not.toHaveBeenCalled();
        });
    });

    test('throws on an unknown token shape', async () => {
        await expect(getTokenFromConfig({ unknown: 'value' } as unknown as Token)).rejects.toThrow('Invalid token configuration');
    });
});
