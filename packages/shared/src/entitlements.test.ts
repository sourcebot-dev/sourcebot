import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { License } from '@sourcebot/db';

const mocks = vi.hoisted(() => ({
    env: {
        SOURCEBOT_PUBLIC_KEY_PATH: '/tmp/test-key',
        SOURCEBOT_EE_LICENSE_KEY: undefined as string | undefined,
        SOURCEBOT_INSTALL_ID: 'test-install',
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
    verifyOnlineLicenseAssertion,
} from './entitlements.js';

const encodeOfflineKey = (payload: object): string => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `sourcebot_ee_${encoded}`;
};

const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

const validOfflineKey = (overrides: { seats?: number; anonymousAccess?: boolean; expiryDate?: string } = {}) =>
    encodeOfflineKey({
        id: 'test-customer',
        expiryDate: overrides.expiryDate ?? futureDate,
        ...(overrides.seats !== undefined ? { seats: overrides.seats } : {}),
        ...(overrides.anonymousAccess !== undefined ? { anonymousAccess: overrides.anonymousAccess } : {}),
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
    trialEnd: null,
    hasPaymentMethod: null,
    yearlyTermStartedAt: null,
    yearlyTermEndsAt: null,
    yearlyTotalQuartersInTerm: null,
    yearlyCurrentQuarterNumber: null,
    yearlyCurrentQuarterStartedAt: null,
    yearlyCurrentQuarterEndsAt: null,
    yearlyCommittedSeats: null,
    yearlyOverageSeats: null,
    yearlyBillableOverageSeats: null,
    yearlyPeakSeats: null,
    lastSyncAt: new Date(),
    lastSyncErrorCode: null,
    licenseAssertion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

const onlineAssertion = (
    overrides: { license?: Record<string, unknown>; omitLicense?: boolean } & Record<string, unknown> = {},
): string => {
    const { license: licenseOverrides, omitLicense, ...payloadOverrides } = overrides;
    const payload = {
        version: 1,
        audience: 'sourcebot-online-license',
        licenseId: 'subscription-1',
        installId: 'test-install',
        issuedAt: new Date(Date.now() - 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ...(!omitLicense && {
            license: {
                status: 'active',
                entitlements: ['sso'],
                seats: 10,
                planName: 'Enterprise',
                unitAmount: 10000,
                currency: 'usd',
                interval: 'month',
                intervalCount: 1,
                nextRenewalAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                nextRenewalAmount: 10000,
                cancelAt: null,
                trialEnd: null,
                hasPaymentMethod: true,
                ...licenseOverrides,
            },
        }),
        ...payloadOverrides,
    };

    return `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.fake-signature`;
};

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

    describe('with a signed active online license', () => {
        test.each(['active', 'trialing', 'past_due'] as const)(
            'returns false when status is %s',
            (status) => {
                expect(isAnonymousAccessAvailable(makeLicense({
                    licenseAssertion: onlineAssertion({ license: { status } }),
                }))).toBe(false);
            }
        );
    });

    describe('with an offline license key', () => {
        test('returns false when offline key does not grant anonymous access', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 100 });
            expect(isAnonymousAccessAvailable(null)).toBe(false);
        });

        test('returns false when offline key is uncapped but does not grant anonymous access', () => {
            // Uncapped (no seats) no longer implies anonymous access — it must
            // be granted explicitly via the `anonymousAccess` flag.
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey();
            expect(isAnonymousAccessAvailable(null)).toBe(false);
        });

        test('returns true when offline key explicitly grants anonymous access', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ anonymousAccess: true });
            expect(isAnonymousAccessAvailable(null)).toBe(true);
        });

        test('anonymous access is independent of the seat cap', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 100, anonymousAccess: true });
            expect(isAnonymousAccessAvailable(null)).toBe(true);
        });

        test('anonymous-access offline key beats an active online license', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ anonymousAccess: true });
            expect(isAnonymousAccessAvailable(makeLicense({
                licenseAssertion: onlineAssertion(),
            }))).toBe(true);
        });

        test('falls through to online license check when offline key is expired', () => {
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ anonymousAccess: true, expiryDate: pastDate });
            expect(isAnonymousAccessAvailable(null)).toBe(true);
            expect(isAnonymousAccessAvailable(makeLicense({
                licenseAssertion: onlineAssertion(),
            }))).toBe(false);
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
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ anonymousAccess: true });
            mocks.verifySignature.mockReturnValue(false);
            expect(isAnonymousAccessAvailable(null)).toBe(true);
        });
    });
});

describe('getEntitlements', () => {
    test('returns empty array when no license and no offline key', () => {
        expect(getEntitlements(null)).toEqual([]);
    });

    test('does not trust unsigned entitlements when license status is active', () => {
        const license = makeLicense({ status: 'active', entitlements: ['sso', 'audit'] });
        expect(getEntitlements(license)).toEqual([]);
    });

    test('returns empty when license has no status', () => {
        expect(getEntitlements(makeLicense({ entitlements: ['sso'] }))).toEqual([]);
    });

    describe('signed online assertions', () => {
        describe('claim validation', () => {
            test('rejects an unsupported version', () => {
                expect(verifyOnlineLicenseAssertion(onlineAssertion({ version: 2 }))).toBeNull();
            });

            test('rejects an assertion for another audience', () => {
                expect(verifyOnlineLicenseAssertion(onlineAssertion({ audience: 'another-service' }))).toBeNull();
            });

            test.each([
                ['missing', undefined],
                ['empty', ''],
            ])('rejects a %s licenseId', (_description, licenseId) => {
                expect(verifyOnlineLicenseAssertion(onlineAssertion({ licenseId }))).toBeNull();
            });

            test.each([
                ['missing', undefined],
                ['empty', ''],
                ['different', 'different-install'],
            ])('rejects a %s installId', (_description, installId) => {
                expect(verifyOnlineLicenseAssertion(onlineAssertion({ installId }))).toBeNull();
            });

            test('rejects an invalid issuedAt timestamp', () => {
                expect(verifyOnlineLicenseAssertion(onlineAssertion({ issuedAt: 'not-a-date' }))).toBeNull();
            });

            test('rejects an assertion issued beyond the clock-skew allowance', () => {
                expect(verifyOnlineLicenseAssertion(onlineAssertion({
                    issuedAt: new Date(Date.now() + 6 * 60 * 1000).toISOString(),
                }))).toBeNull();
            });

            test('rejects an invalid expiresAt timestamp', () => {
                expect(verifyOnlineLicenseAssertion(onlineAssertion({ expiresAt: 'not-a-date' }))).toBeNull();
            });

            test('rejects an expired assertion', () => {
                expect(verifyOnlineLicenseAssertion(onlineAssertion({
                    issuedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                }))).toBeNull();
            });

            test('rejects an assertion that does not expire after it was issued', () => {
                const timestamp = new Date(Date.now() + 60 * 1000).toISOString();
                expect(verifyOnlineLicenseAssertion(onlineAssertion({
                    issuedAt: timestamp,
                    expiresAt: timestamp,
                }))).toBeNull();
            });

            test('rejects an assertion valid for longer than seven days', () => {
                const issuedAt = new Date();
                expect(verifyOnlineLicenseAssertion(onlineAssertion({
                    issuedAt: issuedAt.toISOString(),
                    expiresAt: new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000 + 1).toISOString(),
                }))).toBeNull();
            });

            test('rejects a missing license snapshot', () => {
                expect(verifyOnlineLicenseAssertion(onlineAssertion({ omitLicense: true }))).toBeNull();
            });

            test.each([
                ['entitlements', [1]],
                ['seats', -1],
                ['status', null],
                ['planName', null],
                ['unitAmount', 1.5],
                ['currency', null],
                ['interval', null],
                ['intervalCount', 1.5],
                ['nextRenewalAt', 'not-a-date'],
                ['nextRenewalAmount', 1.5],
                ['cancelAt', 'not-a-date'],
                ['trialEnd', 'not-a-date'],
                ['hasPaymentMethod', 'yes'],
                ['yearlyTermStatus', {}],
            ])('rejects an invalid license.%s claim', (field, value) => {
                expect(verifyOnlineLicenseAssertion(onlineAssertion({
                    license: { [field]: value },
                }))).toBeNull();
            });
        });

        test('uses entitlements from a valid assertion instead of mutable columns', () => {
            const license = makeLicense({
                status: 'active',
                entitlements: ['audit'],
                licenseAssertion: onlineAssertion({ license: { entitlements: ['sso'] } }),
            });

            expect(getEntitlements(license)).toEqual(['sso']);
        });

        test('preserves the complete signed license snapshot', () => {
            const assertion = onlineAssertion({
                license: {
                    planName: 'Signed Enterprise',
                    unitAmount: 25000,
                    nextRenewalAmount: 50000,
                    hasPaymentMethod: false,
                },
            });

            expect(verifyOnlineLicenseAssertion(assertion)?.license).toMatchObject({
                entitlements: ['sso'],
                seats: 10,
                status: 'active',
                planName: 'Signed Enterprise',
                unitAmount: 25000,
                currency: 'usd',
                interval: 'month',
                intervalCount: 1,
                nextRenewalAmount: 50000,
                cancelAt: null,
                trialEnd: null,
                hasPaymentMethod: false,
            });
        });

        test('ignores unknown future entitlements while preserving known entitlements', () => {
            const license = makeLicense({
                status: 'active',
                licenseAssertion: onlineAssertion({
                    license: {
                        entitlements: ['sso', 'future-entitlement'],
                    },
                }),
            });

            expect(getEntitlements(license)).toEqual(['sso']);
        });

        test('does not fall back to mutable columns when the signature is invalid', () => {
            mocks.verifySignature.mockReturnValue(false);
            const license = makeLicense({
                status: 'active',
                entitlements: ['audit'],
                licenseAssertion: onlineAssertion(),
            });

            expect(getEntitlements(license)).toEqual([]);
        });

        test('rejects an assertion issued for another installation', () => {
            const license = makeLicense({
                status: 'active',
                entitlements: ['audit'],
                licenseAssertion: onlineAssertion({ installId: 'different-install' }),
            });

            expect(getEntitlements(license)).toEqual([]);
        });

        test('rejects an expired assertion even when lastSyncAt was forged', () => {
            const license = makeLicense({
                status: 'active',
                entitlements: ['audit'],
                lastSyncAt: new Date(),
                licenseAssertion: onlineAssertion({
                    issuedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
                    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                }),
            });

            expect(getEntitlements(license)).toEqual([]);
        });

        test('rejects active mutable columns when the signed status is canceled', () => {
            const license = makeLicense({
                status: 'active',
                entitlements: ['audit'],
                licenseAssertion: onlineAssertion({ license: { status: 'canceled' } }),
            });

            expect(getEntitlements(license)).toEqual([]);
        });

        test('parses an unknown future status but grants no entitlements', () => {
            const licenseAssertion = onlineAssertion({
                license: { status: 'future-status' },
            });
            const license = makeLicense({
                status: 'active',
                entitlements: ['sso'],
                licenseAssertion,
            });

            expect(verifyOnlineLicenseAssertion(licenseAssertion)?.license.status).toBe('future-status');
            expect(getEntitlements(license)).toEqual([]);
        });
    });

    test('returns all entitlements when offline key is valid', () => {
        mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 50 });
        const result = getEntitlements(null);
        expect(result).toContain('sso');
        expect(result).toContain('audit');
        expect(result).toContain('search-contexts');
    });

    test('does not fall through to unsigned columns when an offline key is expired', () => {
        mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 50, expiryDate: pastDate });
        expect(getEntitlements(null)).toEqual([]);
        expect(
            getEntitlements(makeLicense({ status: 'active', entitlements: ['sso'] }))
        ).toEqual([]);
    });

    test('falls through when offline key is malformed', () => {
        mocks.env.SOURCEBOT_EE_LICENSE_KEY = 'sourcebot_ee_not-a-valid-payload';
        expect(getEntitlements(null)).toEqual([]);
    });

    describe('online license rebound elsewhere', () => {
        test('returns empty when lastSyncErrorCode is ACTIVATION_CODE_BOUND_TO_DIFFERENT_INSTANCE', () => {
            const license = makeLicense({
                licenseAssertion: onlineAssertion(),
                lastSyncErrorCode: 'ACTIVATION_CODE_BOUND_TO_DIFFERENT_INSTANCE',
            });
            expect(getEntitlements(license)).toEqual([]);
        });

        test('returns entitlements when lastSyncErrorCode is some other error code', () => {
            // Only ACTIVATION_CODE_BOUND_TO_DIFFERENT_INSTANCE invalidates the
            // local license. Other sync errors are persisted for visibility but
            // don't strip entitlements (avoids paging operators on transient
            // upstream issues).
            const license = makeLicense({
                licenseAssertion: onlineAssertion(),
                lastSyncErrorCode: 'UNKNOWN_STRIPE_PRODUCT',
            });
            expect(getEntitlements(license)).toEqual(['sso']);
        });

        test('offline license overrides the rebound-elsewhere gate', () => {
            // Offline licenses don't rely on /ping, so a stale online error
            // should not affect them.
            mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey();
            const license = makeLicense({
                licenseAssertion: onlineAssertion(),
                lastSyncErrorCode: 'ACTIVATION_CODE_BOUND_TO_DIFFERENT_INSTANCE',
            });
            expect(getEntitlements(license).length).toBeGreaterThan(0);
        });
    });
});

describe('hasEntitlement', () => {
    test('returns true when entitlement is present in a signed assertion', () => {
        expect(
            hasEntitlement('sso', makeLicense({ licenseAssertion: onlineAssertion() }))
        ).toBe(true);
    });

    test('returns false when entitlement is absent from a signed assertion', () => {
        expect(
            hasEntitlement('audit', makeLicense({ licenseAssertion: onlineAssertion() }))
        ).toBe(false);
    });

    test('returns true for any entitlement when offline key is valid', () => {
        mocks.env.SOURCEBOT_EE_LICENSE_KEY = validOfflineKey({ seats: 50 });
        expect(hasEntitlement('sso', null)).toBe(true);
        expect(hasEntitlement('audit', null)).toBe(true);
    });
});
