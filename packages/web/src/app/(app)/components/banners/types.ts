export const BannerPriority = {
    LICENSE_EXPIRED:          100,
    SERVICE_PING_ENFORCED:     95,
    INVOICE_PAST_DUE:          90,
    PERMISSION_SYNC:           50,
    TRIAL:                     25,
    LICENSE_EXPIRY_HEADS_UP:   20,
    SERVICE_PING_FAILED:       10,
} as const;

export type BannerId =
    | 'licenseExpired'
    | 'invoicePastDue'
    | 'permissionSync'
    | 'licenseExpiryHeadsUp'
    | 'trial'
    | 'servicePingFailed';

import type { OrgRole } from "@sourcebot/db";

export interface BannerProps {
    id: BannerId;
    dismissible: boolean;
    role: OrgRole | null;
    now: Date;
}

export interface BannerDescriptor {
    id: BannerId;
    priority: number;
    dismissible: boolean;
    audience: 'everyone' | 'owner';
    render: (props: BannerProps) => React.ReactNode;
}

export const DISMISS_COOKIE_PREFIX = 'banner_dismissed_';
