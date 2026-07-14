import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    setSentryUser: vi.fn(),
    useSession: vi.fn(),
}));

vi.mock('@/lib/sentryUser', () => ({
    setSentryUser: mocks.setSentryUser,
}));

vi.mock('next-auth/react', () => ({
    useSession: mocks.useSession,
}));

const { SentryUserProvider } = await import('./sentryUserProvider');

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('SentryUserProvider', () => {
    test('waits for the session before changing the Sentry user', () => {
        mocks.useSession.mockReturnValue({ data: undefined, status: 'loading' });

        render(<SentryUserProvider isPiiEnabled={false} />);

        expect(mocks.setSentryUser).not.toHaveBeenCalled();
    });

    test('sets and clears the Sentry user as authentication changes', () => {
        const user = {
            id: 'user-1',
            email: 'user@example.com',
            name: 'Example User',
        };
        mocks.useSession.mockReturnValue({
            data: { user },
            status: 'authenticated',
        });

        const { rerender } = render(<SentryUserProvider isPiiEnabled={true} />);
        expect(mocks.setSentryUser).toHaveBeenLastCalledWith(user, true);

        mocks.useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
        rerender(<SentryUserProvider isPiiEnabled={true} />);

        expect(mocks.setSentryUser).toHaveBeenLastCalledWith(null, true);
    });
});
