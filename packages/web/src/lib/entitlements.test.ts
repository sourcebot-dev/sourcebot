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
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
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

    test('returns true when FORCE_ENABLE_ANONYMOUS_ACCESS is true, regardless of the org setting', async () => {
        mocks.env.FORCE_ENABLE_ANONYMOUS_ACCESS = 'true';
        prisma.org.findUnique.mockResolvedValue({ ...MOCK_ORG, isAnonymousAccessEnabled: false });

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

    test('returns false when org.isAnonymousAccessEnabled is false', async () => {
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            isAnonymousAccessEnabled: false,
        });

        expect(await isAnonymousAccessEnabled()).toBe(false);
    });

    test('returns true when org.isAnonymousAccessEnabled is true', async () => {
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            isAnonymousAccessEnabled: true,
        });

        expect(await isAnonymousAccessEnabled()).toBe(true);
    });

    test('returns false when FORCE_ENABLE_ANONYMOUS_ACCESS is "false", overriding the org setting', async () => {
        mocks.env.FORCE_ENABLE_ANONYMOUS_ACCESS = 'false';
        prisma.org.findUnique.mockResolvedValue({
            ...MOCK_ORG,
            isAnonymousAccessEnabled: true,
        });

        expect(await isAnonymousAccessEnabled()).toBe(false);
    });
});
