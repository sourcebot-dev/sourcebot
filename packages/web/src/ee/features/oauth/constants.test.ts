import { expect, test, describe } from 'vitest';
import { UNPERMITTED_SCHEMES, isPermittedRedirectUrl } from './constants';

describe('UNPERMITTED_SCHEMES', () => {
    // Dangerous schemes that must be blocked
    test.each([
        'javascript:',
        'JavaScript:',
        'JAVASCRIPT:',
        'data:',
        'Data:',
        'DATA:',
        'vbscript:',
        'VBScript:',
        'VBSCRIPT:',
    ])('blocks %s', (scheme) => {
        expect(UNPERMITTED_SCHEMES.test(scheme)).toBe(true);
    });

    // Full URL strings (used in /oauth/complete page)
    test.each([
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:MsgBox("xss")',
    ])('blocks full URL string: %s', (url) => {
        expect(UNPERMITTED_SCHEMES.test(url)).toBe(true);
    });

    // Permitted schemes that must not be blocked
    test.each([
        'http:',
        'https:',
        'vscode:',
        'cursor:',
        'claude:',
        'vscode://callback',
        'cursor://callback?code=abc',
        'http://localhost:8080/callback',
        'https://example.com/callback',
    ])('permits %s', (url) => {
        expect(UNPERMITTED_SCHEMES.test(url)).toBe(false);
    });
});

describe('isPermittedRedirectUrl', () => {
    // --- Permitted URLs ---

    test('permits https URLs', () => {
        expect(isPermittedRedirectUrl('https://example.com/callback')).toBe(true);
    });

    test('permits http URLs', () => {
        expect(isPermittedRedirectUrl('http://localhost:8080/callback')).toBe(true);
    });

    test('permits /oauth/complete relative paths', () => {
        expect(isPermittedRedirectUrl('/oauth/complete?url=vscode%3A%2F%2Fcallback')).toBe(true);
    });

    test('permits /oauth/complete with encoded custom scheme', () => {
        expect(isPermittedRedirectUrl('/oauth/complete?url=cursor%3A%2F%2Fcallback%3Fcode%3Dabc')).toBe(true);
    });

    test('permits https URL with query params and fragment', () => {
        expect(isPermittedRedirectUrl('https://example.com/callback?code=abc&state=xyz#fragment')).toBe(true);
    });

    // --- Blocked URLs ---

    test('blocks javascript: URLs', () => {
        expect(isPermittedRedirectUrl('javascript:alert(1)')).toBe(false);
    });

    test('blocks data: URLs', () => {
        expect(isPermittedRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    test('blocks vbscript: URLs', () => {
        expect(isPermittedRedirectUrl('vbscript:MsgBox("xss")')).toBe(false);
    });

    test('blocks javascript: with mixed case', () => {
        expect(isPermittedRedirectUrl('JavaScript:alert(1)')).toBe(false);
    });

    test('blocks custom scheme URLs not wrapped in /oauth/complete', () => {
        expect(isPermittedRedirectUrl('vscode://callback?code=abc')).toBe(false);
    });

    test('blocks malformed URLs', () => {
        expect(isPermittedRedirectUrl('not a url at all')).toBe(false);
    });

    test('blocks empty string', () => {
        expect(isPermittedRedirectUrl('')).toBe(false);
    });

    test('blocks relative paths that do not start with /oauth/complete', () => {
        expect(isPermittedRedirectUrl('/some/other/path')).toBe(false);
    });
});
