import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs/promises so loadConfig doesn't hit the filesystem.
// The config schema has no required fields, so '{}' is valid.
vi.mock('fs/promises', () => ({
    readFile: vi.fn().mockResolvedValue('{}'),
}));

describe('PERMISSION_SYNC_ENABLED', () => {
    beforeEach(() => {
        vi.resetModules();
        delete process.env.PERMISSION_SYNC_ENABLED;
        delete process.env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED;
    });

    afterEach(() => {
        delete process.env.PERMISSION_SYNC_ENABLED;
        delete process.env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED;
    });

    test('is true when PERMISSION_SYNC_ENABLED=true', async () => {
        process.env.PERMISSION_SYNC_ENABLED = 'true';
        const { env } = await import('./env.server.js');
        expect(env.PERMISSION_SYNC_ENABLED).toBe('true');
    });

    test('is false when PERMISSION_SYNC_ENABLED=false', async () => {
        process.env.PERMISSION_SYNC_ENABLED = 'false';
        const { env } = await import('./env.server.js');
        expect(env.PERMISSION_SYNC_ENABLED).toBe('false');
    });

    test('falls back to EXPERIMENT_EE_PERMISSION_SYNC_ENABLED=true when PERMISSION_SYNC_ENABLED is not set', async () => {
        process.env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED = 'true';
        const { env } = await import('./env.server.js');
        expect(env.PERMISSION_SYNC_ENABLED).toBe('true');
    });

    test('falls back to EXPERIMENT_EE_PERMISSION_SYNC_ENABLED=false when PERMISSION_SYNC_ENABLED is not set', async () => {
        process.env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED = 'false';
        const { env } = await import('./env.server.js');
        expect(env.PERMISSION_SYNC_ENABLED).toBe('false');
    });

    test('defaults to false when neither flag is set', async () => {
        const { env } = await import('./env.server.js');
        expect(env.PERMISSION_SYNC_ENABLED).toBe('false');
    });

    test('PERMISSION_SYNC_ENABLED takes precedence over EXPERIMENT_EE_PERMISSION_SYNC_ENABLED', async () => {
        process.env.PERMISSION_SYNC_ENABLED = 'false';
        process.env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED = 'true';
        const { env } = await import('./env.server.js');
        expect(env.PERMISSION_SYNC_ENABLED).toBe('false');
    });
});

describe('SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS', () => {
    beforeEach(() => {
        vi.resetModules();
        delete process.env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS;
    });

    afterEach(() => {
        delete process.env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS;
    });

    test('defaults to 60000 when not set', async () => {
        const { env } = await import('./env.server.js');
        expect(env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS).toBe(60000);
    });

    test('accepts positive integers', async () => {
        process.env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS = '5000';
        const { env } = await import('./env.server.js');
        expect(env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS).toBe(5000);
    });

    test.each(['0', '-1', '1.5', '2147483648', String(Number.MAX_SAFE_INTEGER + 1)])('rejects %s', async (timeoutMs) => {
        process.env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS = timeoutMs;

        await expect(import('./env.server.js')).rejects.toThrow();
    });
});

describe('SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED', () => {
    beforeEach(() => {
        vi.resetModules();
        delete process.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED;
    });

    afterEach(() => {
        delete process.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED;
    });

    test('defaults to false', async () => {
        const { env } = await import('./env.server.js');
        expect(env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED).toBe('false');
    });

    test.each(['true', 'false'])('accepts %s', async (enabled) => {
        process.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED = enabled;
        const { env } = await import('./env.server.js');
        expect(env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED).toBe(enabled);
    });
});
