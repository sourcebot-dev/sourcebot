import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { License } from '@sourcebot/db';

const mocks = vi.hoisted(() => ({
    env: {
        SOURCEBOT_PUBLIC_KEY_PATH: '/tmp/test-key',
        SOURCEBOT_EE_LICENSE_KEY: undefined as string | undefined,
    } as Record<string, string | undefined>,
    verifySignature: vi.fn(() => true),
}));

vi.mock('./env.server.js', () => ({
    env: mocks.env,
}));

vi.mock('./crypto.js', () => ({
    verifySignature: mocks.verifySignature,
}));

vi.mock('./logger.js', () => ({
    createLogger: () => ({
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    }),
}));

import {
    isAnonymousAccessAvailable,
    getEntitlements,
    hasEntitlement,
} from './entitlements.js';

const encodeOfflineKey = (payload: object): string => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `sourcebot_ee_${encoded}`;
};

const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

const validOfflineKey = (overrides: { seats?: number; expiryDate?: string } = {}) =>
    encodeOfflineKey({
        id: 'test-customer',
        expiryDate: overrides.expiryDate ?? futureDate,
        ...(overrides.seats !== undefined ? { seats: overrides.seats } : {}),
        sig: 'fake-sig',
    });

const makeLicense = (overrides: Partial<License> = {}): License => ({
    id: 'lic_1',
    orgId: 1,
    activationCode: 'code',
    entitlements: [],
    seats: null,
    status: null,
    planName: null,
    unitAmount: null,
    currency: null,
    interval: null,
    intervalCount: null,
    nextRenewalAt: null,
    nextRenewalAmount: null,
    cancelAt: null,
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

beforeEach(() => {
    mocks.env.SOURCEBOT_EE_LICENSE_KEY = undefined;
    mocks.verifySignature.mockReturnValue(true);
});

describe('isAnonymousAccessAvailable', () => {
    describe('without any license', () => {
        test('returns true when license is null', () => {
            expect(isAnonymousAccessAvailable(null)).toBe(true);
        });

        test('returns true when license has no status', () => {
            expect(isAnonymousAccessAvailable(makeLicense())).toBe(true);
        });

        test('returns true when license status is canceled', () => {
            expect(isAnonymousAccessAvailable(makeLicense({ status: 'canceled' }))).toBe(true);
        });
    });

    describe('with an active online license', () => {
        test.each(['active', 'trialing', 'past_due'] as const)(
            'returns false when status is %s',
            (status) => {
                expect(isAnonymousAccessAvailable(makeLicense({ status }))).toBe(false);
            }
        );
    });

    describe('with an offline license key', () => {
        test('returns false when offline key has a seat count', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 100 });
            expect(isAnonymousAccessAvailable(null)).toBe(false);
        });

        test('returns true when offline key has no seat count (unlimited)', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey();
            expect(isAnonymousAccessAvailable(null)).toBe(true);
        });

        test('unlimited offline key beats an active online license', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey();
            expect(isAnonymousAccessAvailable(makeLicense({ status: 'active' }))).toBe(true);
        });

        test('falls through to online license check when offline key is expired', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 100, expiryDate: pastDate });
            expect(isAnonymousAccessAvailable(null)).toBe(true);
            expect(isAnonymousAccessAvailable(makeLicense({ status: 'active' }))).toBe(false);
        });

        test('falls through when offline key is malformed', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = 'sourcebot_ee_not-valid-base64-or-json';
            expect(isAnonymousAccessAvailable(null)).toBe(true);
        });

        test('falls through when offline key has wrong prefix', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = 'bogus_prefix_xyz';
            expect(isAnonymousAccessAvailable(null)).toBe(true);
        });

        test('falls through when offline key signature is invalid', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 100 });
            mocks.verifySignature.mockReturnValue(false);
            expect(isAnonymousAccessAvailable(null)).toBe(true);
        });
    });
});

describe('getEntitlements', () => {
    test('returns empty array when no license and no offline key', () => {
        expect(getEntitlements(null)).toEqual([]);
    });

    test('returns license.entitlements when license is active', () => {
        const license = makeLicense({ status: 'active', entitlements: ['sso', 'audit'] });
        expect(getEntitlements(license)).toEqual(['sso', 'audit']);
    });

    test('returns empty when license has no status', () => {
        expect(getEntitlements(makeLicense({ entitlements: ['sso'] }))).toEqual([]);
    });

    test('returns all entitlements when offline key is valid', () => {
        mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 50 });
        const result = getEntitlements(null);
        expect(result).toContain('sso');
        expect(result).toContain('audit');
        expect(result).toContain('search-contexts');
    });

    test('falls through when offline key is expired', () => {
        mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 50, expiryDate: pastDate });
        expect(getEntitlements(null)).toEqual([]);
        expect(
            getEntitlements(makeLicense({ status: 'active', entitlements: ['sso'] }))
        ).toEqual(['sso']);
    });

    test('falls through when offline key is malformed', () => {
        mocks.env.SOURCEBOT_EE_LICENSE_KEY = 'sourcebot_ee_not-a-valid-payload';
        expect(getEntitlements(null)).toEqual([]);
    });
});

describe('hasEntitlement', () => {
    test('returns true when entitlement is present in license', () => {
        expect(
            hasEntitlement('sso', makeLicense({ status: 'active', entitlements: ['sso'] }))
        ).toBe(true);
    });

    test('returns false when entitlement is absent from license', () => {
        expect(
            hasEntitlement('audit', makeLicense({ status: 'active', entitlements: ['sso'] }))
        ).toBe(false);
    });

    test('returns true for any entitlement when offline key is valid', () => {
        mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 50 });
        expect(hasEntitlement('sso', null)).toBe(true);
        expect(hasEntitlement('audit', null)).toBe(true);
    });
});
