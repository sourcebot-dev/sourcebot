import { OrgRole, type License } from "@sourcebot/db";
import type { LicenseStatus, OfflineLicenseMetadata } from "@sourcebot/shared";
import { BannerPriority, type BannerDescriptor, type BannerId } from "./types";
import { PermissionSyncBanner } from "./permissionSyncBanner";
import { LicenseExpiredBanner } from "./licenseExpiredBanner";
import { LicenseExpiryHeadsUpBanner } from "./licenseExpiryHeadsUpBanner";
import { InvoicePastDueBanner } from "./invoicePastDueBanner";

const EXPIRY_HEADS_UP_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface BannerContext {
    role: OrgRole | null;
    license: License | null;
    offlineLicense: OfflineLicenseMetadata | null;
    hasPermissionSyncEntitlement: boolean;
    hasPendingFirstSync: boolean;
    dismissals: Partial<Record<BannerId, string>>;
    today: string;
    now: Date;
}

export function resolveActiveBanner(ctx: BannerContext): BannerDescriptor | null {
    const candidates = buildCandidates(ctx)
        .filter((b) => b.audience === 'everyone' || ctx.role === OrgRole.OWNER)
        .filter((b) => !(b.dismissible && ctx.dismissals[b.id] === ctx.today));

    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0] ?? null;
}

function buildCandidates(ctx: BannerContext): BannerDescriptor[] {
    const banners: BannerDescriptor[] = [];

    const expiryState = getLicenseExpiryState(ctx);
    if (expiryState?.kind === 'expired') {
        banners.push({
            id: 'licenseExpired',
            priority: BannerPriority.LICENSE_EXPIRED,
            dismissible: false,
            audience: 'everyone',
            render: (props) => (
                <LicenseExpiredBanner {...props} source={expiryState.source} />
            ),
        });
    }
    if (expiryState?.kind === 'expiring-soon') {
        banners.push({
            id: 'licenseExpiryHeadsUp',
            priority: BannerPriority.LICENSE_EXPIRY_HEADS_UP,
            dismissible: true,
            audience: 'owner',
            render: (props) => (
                <LicenseExpiryHeadsUpBanner
                    {...props}
                    source={expiryState.source}
                    expiresAt={expiryState.expiresAt.toISOString()}
                />
            ),
        });
    }

    if (!ctx.offlineLicense && ctx.license?.status === 'past_due') {
        banners.push({
            id: 'invoicePastDue',
            priority: BannerPriority.INVOICE_PAST_DUE,
            dismissible: false,
            audience: 'owner',
            render: (props) => <InvoicePastDueBanner {...props} />,
        });
    }

    if (ctx.hasPermissionSyncEntitlement && ctx.hasPendingFirstSync) {
        banners.push({
            id: 'permissionSync',
            priority: BannerPriority.PERMISSION_SYNC,
            dismissible: false,
            audience: 'everyone',
            render: (props) => (
                <PermissionSyncBanner {...props} initialHasPendingFirstSync={true} />
            ),
        });
    }

    return banners;
}

const EXPIRED_ONLINE_STATUSES: ReadonlySet<LicenseStatus> = new Set([
    'canceled',
    'incomplete_expired',
    'unpaid',
] satisfies LicenseStatus[]);

type LicenseExpirySource = 'offline' | 'online';

type LicenseExpiryState =
    | { kind: 'expired'; source: LicenseExpirySource }
    | { kind: 'expiring-soon'; source: LicenseExpirySource; expiresAt: Date }
    | null;

// Mirrors the precedence in entitlements.ts: if an offline license is
// present, it is the sole source of truth — online status is ignored.
function getLicenseExpiryState(ctx: BannerContext): LicenseExpiryState {
    const nowMs = ctx.now.getTime();

    if (ctx.offlineLicense) {
        const expiresAt = new Date(ctx.offlineLicense.expiryDate);
        const deltaMs = expiresAt.getTime() - nowMs;
        if (deltaMs <= 0) {
            return { kind: 'expired', source: 'offline' };
        }
        if (deltaMs <= EXPIRY_HEADS_UP_WINDOW_MS) {
            return { kind: 'expiring-soon', source: 'offline', expiresAt };
        }
        return null;
    }

    if (!ctx.license) {
        return null;
    }
    if (ctx.license.status && EXPIRED_ONLINE_STATUSES.has(ctx.license.status as LicenseStatus)) {
        return { kind: 'expired', source: 'online' };
    }
    if (ctx.license.cancelAt) {
        const expiresAt = new Date(ctx.license.cancelAt);
        const deltaMs = expiresAt.getTime() - nowMs;
        if (deltaMs > 0 && deltaMs <= EXPIRY_HEADS_UP_WINDOW_MS) {
            return { kind: 'expiring-soon', source: 'online', expiresAt };
        }
    }
    return null;
}
