import { describe, expect, test, vi } from 'vitest';
import { OrgRole, type License } from '@sourcebot/db';
import type { OfflineLicenseMetadata } from '@sourcebot/shared';

// Stub the rendered banner components — these tests assert on descriptor
// metadata only (id, priority, etc), so avoiding their React/Next.js import
// chains keeps the suite focused on resolver logic.
// Stub @sourcebot/shared: importing its real index initializes env-backed
// server code that can't run in the test environment. The resolver only
// needs the threshold constant; type imports are erased at runtime.
vi.mock('@sourcebot/shared', () => ({
    STALE_ONLINE_LICENSE_THRESHOLD_MS: 7 * 24 * 60 * 60 * 1000,
    STALE_ONLINE_LICENSE_WARNING_THRESHOLD_MS: 48 * 60 * 60 * 1000,
}));

vi.mock('./permissionSyncBanner', () => ({ PermissionSyncBanner: () => null }));
vi.mock('./licenseExpiredBanner', () => ({ LicenseExpiredBanner: () => null }));
vi.mock('./licenseExpiryHeadsUpBanner', () => ({ LicenseExpiryHeadsUpBanner: () => null }));
vi.mock('./invoicePastDueBanner', () => ({ InvoicePastDueBanner: () => null }));
vi.mock('./servicePingFailedBanner', () => ({ ServicePingFailedBanner: () => null }));

import { resolveActiveBanner, type BannerContext } from './bannerResolver';

const NOW = new Date('2026-04-21T12:00:00Z');
const TODAY = '2026-04-21';
const YESTERDAY = '2026-04-20';

const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000);
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000);

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
    lastSyncAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
});

const makeOfflineLicense = (overrides: Partial<OfflineLicenseMetadata> = {}): OfflineLicenseMetadata => ({
    id: 'offline_1',
    expiryDate: daysFromNow(365).toISOString(),
    ...overrides,
});

const makeContext = (overrides: Partial<BannerContext> = {}): BannerContext => ({
    role: OrgRole.OWNER,
    license: null,
    offlineLicense: null,
    hasPermissionSyncEntitlement: false,
    hasPendingFirstSync: false,
    dismissals: {},
    today: TODAY,
    now: NOW,
    ...overrides,
});

describe('resolveActiveBanner', () => {
    describe('priority ordering', () => {
        test('returns null when no conditions match', () => {
            expect(resolveActiveBanner(makeContext())).toBeNull();
        });

        test('returns the only candidate when one matches', () => {
            const result = resolveActiveBanner(makeContext({
                hasPermissionSyncEntitlement: true,
                hasPendingFirstSync: true,
            }));
            expect(result?.id).toBe('permissionSync');
        });

        test('license expired outranks permission sync', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ status: 'canceled' }),
                hasPermissionSyncEntitlement: true,
                hasPendingFirstSync: true,
            }));
            expect(result?.id).toBe('licenseExpired');
        });

        test('permission sync outranks license expiry heads-up', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ cancelAt: hoursFromNow(12) }),
                hasPermissionSyncEntitlement: true,
                hasPendingFirstSync: true,
            }));
            expect(result?.id).toBe('permissionSync');
        });
    });

    describe('audience filtering', () => {
        test('hides owner-only banner from members', () => {
            const result = resolveActiveBanner(makeContext({
                role: OrgRole.MEMBER,
                license: makeLicense({ cancelAt: hoursFromNow(12) }),
            }));
            expect(result).toBeNull();
        });

        test('hides owner-only banner from anonymous viewers', () => {
            const result = resolveActiveBanner(makeContext({
                role: null,
                license: makeLicense({ cancelAt: hoursFromNow(12) }),
            }));
            expect(result).toBeNull();
        });

        test('shows owner-only banner to owners', () => {
            const result = resolveActiveBanner(makeContext({
                role: OrgRole.OWNER,
                license: makeLicense({ cancelAt: hoursFromNow(12) }),
            }));
            expect(result?.id).toBe('licenseExpiryHeadsUp');
        });

        test('shows everyone banner to members', () => {
            const result = resolveActiveBanner(makeContext({
                role: OrgRole.MEMBER,
                license: makeLicense({ status: 'canceled' }),
            }));
            expect(result?.id).toBe('licenseExpired');
        });

        test('shows everyone banner to anonymous viewers', () => {
            const result = resolveActiveBanner(makeContext({
                role: null,
                license: makeLicense({ status: 'canceled' }),
            }));
            expect(result?.id).toBe('licenseExpired');
        });
    });

    describe('dismissal filtering', () => {
        test('filters out dismissible banner dismissed today', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ cancelAt: hoursFromNow(12) }),
                dismissals: { licenseExpiryHeadsUp: TODAY },
            }));
            expect(result).toBeNull();
        });

        test('shows dismissible banner dismissed yesterday', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ cancelAt: hoursFromNow(12) }),
                dismissals: { licenseExpiryHeadsUp: YESTERDAY },
            }));
            expect(result?.id).toBe('licenseExpiryHeadsUp');
        });

        test('shows dismissible banner with no cookie set', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ cancelAt: hoursFromNow(12) }),
            }));
            expect(result?.id).toBe('licenseExpiryHeadsUp');
        });

        test('ignores dismissal cookie on non-dismissible banners', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ status: 'canceled' }),
                dismissals: { licenseExpired: TODAY },
            }));
            expect(result?.id).toBe('licenseExpired');
        });
    });

    describe('offline license expiry', () => {
        test('expired offline → licenseExpired', () => {
            const result = resolveActiveBanner(makeContext({
                offlineLicense: makeOfflineLicense({
                    expiryDate: hoursFromNow(-1).toISOString(),
                }),
            }));
            expect(result?.id).toBe('licenseExpired');
        });

        test('offline within 14d window → licenseExpiryHeadsUp', () => {
            const result = resolveActiveBanner(makeContext({
                offlineLicense: makeOfflineLicense({
                    expiryDate: daysFromNow(10).toISOString(),
                }),
            }));
            expect(result?.id).toBe('licenseExpiryHeadsUp');
        });

        test('offline beyond 14d window → no banner', () => {
            const result = resolveActiveBanner(makeContext({
                offlineLicense: makeOfflineLicense({
                    expiryDate: daysFromNow(30).toISOString(),
                }),
            }));
            expect(result).toBeNull();
        });

        test('precedence: valid offline + canceled online → no banner', () => {
            const result = resolveActiveBanner(makeContext({
                offlineLicense: makeOfflineLicense({
                    expiryDate: daysFromNow(30).toISOString(),
                }),
                license: makeLicense({ status: 'canceled' }),
            }));
            expect(result).toBeNull();
        });

        test('precedence: expired offline + active online → expired (offline wins)', () => {
            const result = resolveActiveBanner(makeContext({
                offlineLicense: makeOfflineLicense({
                    expiryDate: hoursFromNow(-1).toISOString(),
                }),
                license: makeLicense({ status: 'active' }),
            }));
            expect(result?.id).toBe('licenseExpired');
        });
    });

    describe('online license expiry', () => {
        test.each([
            'canceled',
            'unpaid',
            'incomplete_expired',
        ])('status %s → licenseExpired', (status) => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ status }),
            }));
            expect(result?.id).toBe('licenseExpired');
        });

        test('cancelAt within 14d → licenseExpiryHeadsUp', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ cancelAt: daysFromNow(7) }),
            }));
            expect(result?.id).toBe('licenseExpiryHeadsUp');
        });

        test('cancelAt beyond 14d → no banner', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ cancelAt: daysFromNow(30) }),
            }));
            expect(result).toBeNull();
        });

        test('active license with no cancelAt → no banner', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ status: 'active' }),
            }));
            expect(result).toBeNull();
        });

        test('no license at all → no banner', () => {
            expect(resolveActiveBanner(makeContext({ license: null }))).toBeNull();
        });
    });

    describe('invoice past due', () => {
        test('status past_due → invoicePastDue', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ status: 'past_due' }),
            }));
            expect(result?.id).toBe('invoicePastDue');
        });

        test('hidden from non-owners', () => {
            const result = resolveActiveBanner(makeContext({
                role: OrgRole.MEMBER,
                license: makeLicense({ status: 'past_due' }),
            }));
            expect(result).toBeNull();
        });

        test('not shown when offline license is present', () => {
            const result = resolveActiveBanner(makeContext({
                offlineLicense: makeOfflineLicense(),
                license: makeLicense({ status: 'past_due' }),
            }));
            expect(result).toBeNull();
        });

        test('outranks license expiry heads-up when both fire', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({
                    status: 'past_due',
                    cancelAt: hoursFromNow(12),
                }),
            }));
            expect(result?.id).toBe('invoicePastDue');
        });

        test('outranks permission sync', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ status: 'past_due' }),
                hasPermissionSyncEntitlement: true,
                hasPendingFirstSync: true,
            }));
            expect(result?.id).toBe('invoicePastDue');
        });

        test('non-dismissible: cookie does not suppress it', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ status: 'past_due' }),
                dismissals: { invoicePastDue: TODAY },
            }));
            expect(result?.id).toBe('invoicePastDue');
        });
    });

    describe('service ping staleness', () => {
        const WARNING_MS = 48 * 60 * 60 * 1000;
        const ENFORCEMENT_MS = 7 * 24 * 60 * 60 * 1000;
        const msBefore = (ms: number) => new Date(NOW.getTime() - ms);

        test('fresh lastSyncAt → no banner', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ status: 'active', lastSyncAt: msBefore(1000) }),
            }));
            expect(result).toBeNull();
        });

        test('stale between 48h and 7d → warning (dismissible, owner)', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({
                    status: 'active',
                    lastSyncAt: msBefore(WARNING_MS + 60_000),
                }),
            }));
            expect(result?.id).toBe('servicePingFailed');
            expect(result?.dismissible).toBe(true);
            expect(result?.audience).toBe('owner');
        });

        test('stale beyond 7d → enforced (non-dismissible, everyone)', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({
                    status: 'active',
                    lastSyncAt: msBefore(ENFORCEMENT_MS + 60_000),
                }),
            }));
            expect(result?.id).toBe('servicePingFailed');
            expect(result?.dismissible).toBe(false);
            expect(result?.audience).toBe('everyone');
        });

        test('null lastSyncAt on existing license → enforced', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({ status: 'active', lastSyncAt: null }),
            }));
            expect(result?.id).toBe('servicePingFailed');
            expect(result?.audience).toBe('everyone');
        });

        test('offline license suppresses staleness banner', () => {
            const result = resolveActiveBanner(makeContext({
                offlineLicense: makeOfflineLicense(),
                license: makeLicense({ status: 'active', lastSyncAt: null }),
            }));
            expect(result).toBeNull();
        });

        test('warning banner hidden from non-owners', () => {
            const result = resolveActiveBanner(makeContext({
                role: OrgRole.MEMBER,
                license: makeLicense({
                    status: 'active',
                    lastSyncAt: msBefore(WARNING_MS + 60_000),
                }),
            }));
            expect(result).toBeNull();
        });

        test('enforced banner shown to non-owners', () => {
            const result = resolveActiveBanner(makeContext({
                role: OrgRole.MEMBER,
                license: makeLicense({
                    status: 'active',
                    lastSyncAt: msBefore(ENFORCEMENT_MS + 60_000),
                }),
            }));
            expect(result?.id).toBe('servicePingFailed');
        });

        test('warning: dismissed today → filtered out', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({
                    status: 'active',
                    lastSyncAt: msBefore(WARNING_MS + 60_000),
                }),
                dismissals: { servicePingFailed: TODAY },
            }));
            expect(result).toBeNull();
        });

        test('enforced: dismissal cookie is ignored', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({
                    status: 'active',
                    lastSyncAt: msBefore(ENFORCEMENT_MS + 60_000),
                }),
                dismissals: { servicePingFailed: TODAY },
            }));
            expect(result?.id).toBe('servicePingFailed');
        });

        test('enforced outranks invoice past due', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({
                    status: 'past_due',
                    lastSyncAt: msBefore(ENFORCEMENT_MS + 60_000),
                }),
            }));
            expect(result?.id).toBe('servicePingFailed');
            expect(result?.audience).toBe('everyone');
        });

        test('license expired outranks enforced ping staleness', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({
                    status: 'canceled',
                    lastSyncAt: msBefore(ENFORCEMENT_MS + 60_000),
                }),
            }));
            expect(result?.id).toBe('licenseExpired');
        });

        test('warning ranks below permission sync', () => {
            const result = resolveActiveBanner(makeContext({
                license: makeLicense({
                    status: 'active',
                    lastSyncAt: msBefore(WARNING_MS + 60_000),
                }),
                hasPermissionSyncEntitlement: true,
                hasPendingFirstSync: true,
            }));
            expect(result?.id).toBe('permissionSync');
        });
    });

    describe('permission sync', () => {
        test('entitlement + pending → permissionSync', () => {
            const result = resolveActiveBanner(makeContext({
                hasPermissionSyncEntitlement: true,
                hasPendingFirstSync: true,
            }));
            expect(result?.id).toBe('permissionSync');
        });

        test('no entitlement + pending → no banner', () => {
            const result = resolveActiveBanner(makeContext({
                hasPermissionSyncEntitlement: false,
                hasPendingFirstSync: true,
            }));
            expect(result).toBeNull();
        });

        test('entitlement + not pending → no banner', () => {
            const result = resolveActiveBanner(makeContext({
                hasPermissionSyncEntitlement: true,
                hasPendingFirstSync: false,
            }));
            expect(result).toBeNull();
        });
    });
});
