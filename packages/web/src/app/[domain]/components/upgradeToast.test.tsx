import { describe, expect, test, vi, beforeEach } from 'vitest'
import { getVersionFromString, getVersionString, compareVersions } from './upgradeToast';

// --- Pure utility function tests ---

describe('getVersionFromString', () => {
    test('parses a valid semver string', () => {
        expect(getVersionFromString('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    test('returns null for invalid version strings', () => {
        expect(getVersionFromString('not-a-version')).toBeNull();
        expect(getVersionFromString('1.2.3')).toBeNull(); // missing v prefix
        expect(getVersionFromString('v1.2')).toBeNull(); // missing patch
        expect(getVersionFromString('v1.2.3-beta')).toBeNull(); // pre-release suffix
    });

    test('parses zero versions', () => {
        expect(getVersionFromString('v0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
    });
});

describe('getVersionString', () => {
    test('formats a version object as a string', () => {
        expect(getVersionString({ major: 1, minor: 2, patch: 3 })).toBe('v1.2.3');
    });

    test('formats zero version', () => {
        expect(getVersionString({ major: 0, minor: 0, patch: 0 })).toBe('v0.0.0');
    });
});

describe('compareVersions', () => {
    test('returns 0 for equal versions', () => {
        const v = { major: 1, minor: 2, patch: 3 };
        expect(compareVersions(v, v)).toBe(0);
    });

    test('compares by major version first', () => {
        const a = { major: 2, minor: 0, patch: 0 };
        const b = { major: 1, minor: 9, patch: 9 };
        expect(compareVersions(a, b)).toBeGreaterThan(0);
        expect(compareVersions(b, a)).toBeLessThan(0);
    });

    test('compares by minor version when major is equal', () => {
        const a = { major: 1, minor: 3, patch: 0 };
        const b = { major: 1, minor: 2, patch: 9 };
        expect(compareVersions(a, b)).toBeGreaterThan(0);
        expect(compareVersions(b, a)).toBeLessThan(0);
    });

    test('compares by patch version when major and minor are equal', () => {
        const a = { major: 1, minor: 2, patch: 4 };
        const b = { major: 1, minor: 2, patch: 3 };
        expect(compareVersions(a, b)).toBeGreaterThan(0);
        expect(compareVersions(b, a)).toBeLessThan(0);
    });
});

// --- UpgradeToast isOwner gating test ---

// We mock the external dependencies to isolate the isOwner behavior.
// The key assertion: when isOwner=false, fetch should NOT be called.

const mockToast = vi.fn();
vi.mock('@/components/hooks/use-toast', () => ({
    useToast: () => ({ toast: mockToast }),
}));

vi.mock('usehooks-ts', () => ({
    useLocalStorage: () => [new Date(0).toUTCString(), vi.fn()],
}));

vi.mock('@tanstack/react-query', () => ({
    useQuery: () => ({ data: 'v1.0.0' }),
}));

vi.mock('@/app/api/(client)/client', () => ({
    getVersion: vi.fn(),
}));

describe('UpgradeToast isOwner gating', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        // Reset the global fetch mock before each test
        global.fetch = vi.fn();
    });

    test('does not fetch or show toast when isOwner is false', async () => {
        // Dynamic import after mocks are set up
        const { UpgradeToast } = await import('./upgradeToast');
        const { render } = await import('@testing-library/react');

        render(<UpgradeToast isOwner={false} />);

        // fetch should not have been called because isOwner is false
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockToast).not.toHaveBeenCalled();
    });

    test('fetches GitHub tags when isOwner is true', async () => {
        const mockResponse = {
            json: () => Promise.resolve([{ name: 'v2.0.0' }]),
        };
        global.fetch = vi.fn().mockResolvedValue(mockResponse);

        const { UpgradeToast } = await import('./upgradeToast');
        const { render, waitFor } = await import('@testing-library/react');

        render(<UpgradeToast isOwner={true} />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.github.com/repos/sourcebot-dev/sourcebot/tags'
            );
        });
    });
});
