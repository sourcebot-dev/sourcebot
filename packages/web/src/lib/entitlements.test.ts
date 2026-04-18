import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MOCK_ORG, prisma } from '../__mocks__/prisma';
import { isAnonymousAccessEnabled } from './entitlements';

const mocks = vi.hoisted(() => ({
    isAnonymousAccessAvailable: vi.fn<(license: unknown) => boolean>(() => true),
    env: {} as Record<string, string>,
}));

vi.mock('@/prisma', async () => {
    const actual = await vi.importActual<typeof import('@/__mocks__/prisma')>('@/__mocks__/prisma');
    return { ...actual };
});

vi.mock('server-only', () => ({
    default: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    _isAnonymousAccessAvailable: mocks.isAnonymousAccessAvailable,
    _hasEntitlement: vi.fn(),
    _getEntitlements: vi.fn(),
    env: mocks.env,
}));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAnonymousAccessAvailable.mockReturnValue(true);
    Object.keys(mocks.env).forEach(key => delete mocks.env[key]);
});

describe('isAnonymousAccessEnabled', () => {
    test('returns false when anonymous access is not available', async () => {
        mocks.isAnonymousAccessAvailable.mockReturnValue(false);

        expect(await isAnonymousAccessEnabled()).toBe(false);
    });

    test('returns true when FORCE_ENABLE_ANONYMOUS_ACCESS is true, regardless of metadata', async () => {
        mocks.env.FORCE_ENABLE_ANONYMOUS_ACCESS = 'true';
        prisma.org.findUnique.mockResolvedValue({ ...MOCK_ORG, metadata: null });

        expect(await isAnonymousAccessEnabled()).toBe(true);
    });

    test('returns false when FORCE_ENABLE_ANONYMOUS_ACCESS is true but not available', async () => {
        mocks.isAnonymousAccessAvailable.mockReturnValue(false);
        mocks.env.FORCE_ENABLE_ANONYMOUS_ACCESS = 'true';

        expect(await isAnonymousAccessEnabled()).toBe(false);
    });

    test('returns false when org is missing', async () => {
        prisma.org.findUnique.mockResolvedValue(null);

        expect(await isAnonymousAccessEnabled()).toBe(false);
    });

    test('returns false when org metadata is null', async () => {
        prisma.org.findUnique.mockResolvedValue({ ...MOCK_ORG, metadata: null });

        expect(await isAnonymousAccessEnabled()).toBe(false);
    });

    test('returns false when metadata.anonymousAccessEnabled is absent', async () => {
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            metadata: {},
        });

        expect(await isAnonymousAccessEnabled()).toBe(false);
    });

    test('returns false when metadata.anonymousAccessEnabled is false', async () => {
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            metadata: { anonymousAccessEnabled: false },
        });

        expect(await isAnonymousAccessEnabled()).toBe(false);
    });

    test('returns true when metadata.anonymousAccessEnabled is true', async () => {
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            metadata: { anonymousAccessEnabled: true },
        });

        expect(await isAnonymousAccessEnabled()).toBe(true);
    });

    test('ignores FORCE_ENABLE_ANONYMOUS_ACCESS when not the string "true"', async () => {
        mocks.env.FORCE_ENABLE_ANONYMOUS_ACCESS = 'false';
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            metadata: { anonymousAccessEnabled: false },
        });

        expect(await isAnonymousAccessEnabled()).toBe(false);
    });
});
