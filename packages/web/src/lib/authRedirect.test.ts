import { describe, expect, it } from 'vitest';
import { createLoginUrl, normalizeCallbackUrl } from './authRedirect';

describe('normalizeCallbackUrl', () => {
    it('preserves a relative path and query string', () => {
        expect(normalizeCallbackUrl('/search?query=auth%20flow&isRegexEnabled=true'))
            .toBe('/search?query=auth%20flow&isRegexEnabled=true');
    });

    it('rejects external and protocol-relative URLs', () => {
        expect(normalizeCallbackUrl('https://evil.example.com/login')).toBe('/');
        expect(normalizeCallbackUrl('//evil.example.com/login')).toBe('/');
        expect(normalizeCallbackUrl('search?query=auth')).toBe('/');
    });

    it('rejects malformed callback values', () => {
        expect(normalizeCallbackUrl('\\\\evil.example.com')).toBe('/');
        expect(normalizeCallbackUrl(undefined)).toBe('/');
    });
});

describe('createLoginUrl', () => {
    it('encodes the complete callback URL', () => {
        expect(createLoginUrl('/chat/thread-1?status=error&message=try%20again'))
            .toBe('/login?callbackUrl=%2Fchat%2Fthread-1%3Fstatus%3Derror%26message%3Dtry%2520again');
    });
});
