import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: mocks.refresh,
    }),
}));

const { GitHubRateLimitExceeded } = await import('./githubRateLimitExceeded');

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('GitHubRateLimitExceeded', () => {
    test('offers to retry the request', () => {
        render(<GitHubRateLimitExceeded />);

        expect(screen.getByText('GitHub is temporarily busy')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(mocks.refresh).toHaveBeenCalledOnce();
    });
});
