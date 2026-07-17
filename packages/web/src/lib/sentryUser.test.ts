import { beforeEach, describe, expect, test, vi } from 'vitest';

const setUser = vi.fn();

vi.mock('@sentry/nextjs', () => ({
    setUser,
}));

const { setSentryUser } = await import('./sentryUser');

describe('setSentryUser', () => {
    beforeEach(() => {
        setUser.mockClear();
    });

    test('associates errors with the user id without PII by default', () => {
        setSentryUser({
            id: 'user-1',
            email: 'user@example.com',
            name: 'Example User',
        }, false);

        expect(setUser).toHaveBeenCalledWith({ id: 'user-1' });
    });

    test('includes user details when PII collection is enabled', () => {
        setSentryUser({
            id: 'user-1',
            email: 'user@example.com',
            name: 'Example User',
        }, true);

        expect(setUser).toHaveBeenCalledWith({
            id: 'user-1',
            email: 'user@example.com',
            username: 'Example User',
        });
    });

    test('clears the user for unauthenticated requests', () => {
        setSentryUser(null, true);

        expect(setUser).toHaveBeenCalledWith(null);
    });
});
