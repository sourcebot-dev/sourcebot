import { expect, test, describe } from 'vitest';
import { sanitizeMcpServerName } from './utils';

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
