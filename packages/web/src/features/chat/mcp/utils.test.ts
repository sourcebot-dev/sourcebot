import { expect, test, describe } from 'vitest';
import { getMcpFaviconUrl, sanitizeMcpServerName } from './utils';

describe('sanitizeMcpServerName', () => {
    test('lowercases ASCII letters', () => {
        expect(sanitizeMcpServerName('MyServer')).toBe('myserver');
    });

    test('replaces special characters with underscores', () => {
        expect(sanitizeMcpServerName('My Server!')).toBe('my_server_');
    });

    test('preserves digits', () => {
        expect(sanitizeMcpServerName('server123')).toBe('server123');
    });

    test('replaces spaces and hyphens', () => {
        expect(sanitizeMcpServerName('my-cool server')).toBe('my_cool_server');
    });

    test('handles empty string', () => {
        expect(sanitizeMcpServerName('')).toBe('');
    });

    test('replaces unicode characters with underscores', () => {
        expect(sanitizeMcpServerName('Ñoño')).toBe('_o_o');
    });

    test('replaces all special characters', () => {
        expect(sanitizeMcpServerName('@#$%')).toBe('____');
    });

    test('returns already sanitized name unchanged', () => {
        expect(sanitizeMcpServerName('linear')).toBe('linear');
    });
});

describe('getMcpFaviconUrl', () => {
    test('returns a Google favicon URL for a valid server URL', () => {
        expect(getMcpFaviconUrl('https://mcp.linear.app/mcp')).toBe('https://www.google.com/s2/favicons?domain=https://mcp.linear.app&sz=32');
    });

    test('returns a local Atlassian icon for the Atlassian prefab server', () => {
        expect(getMcpFaviconUrl('https://mcp.atlassian.com/v1/mcp/authv2', 'Atlassian')).toMatch(/^data:image\/svg\+xml,/);
    });

    test('returns undefined for a malformed server URL', () => {
        expect(getMcpFaviconUrl('not a url')).toBeUndefined();
    });
});
