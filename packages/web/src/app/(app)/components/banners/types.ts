import { ReactNode } from "react";
import type { OrgRole } from "@sourcebot/db";

export const BannerPriority = {
    LICENSE_EXPIRED:          100,
    LICENSE_REBOUND_ELSEWHERE: 97,
    SERVICE_PING_ENFORCED:     95,
    INVOICE_PAST_DUE:          90,
    PERMISSION_SYNC:           50,
    CONNECTION_SYNC_FAILED:    48,
    REPOSITORY_SYNC_FAILED:    45,
    TRIAL:                     25,
    LICENSE_EXPIRY_HEADS_UP:   20,
    CONNECTION_SYNC_WARNING:   18,
    REPOSITORY_SYNC_WARNING:   15,
    CONNECTION_FIRST_SYNC:     14,
    REPOSITORY_FIRST_SYNC:     12,
    SERVICE_PING_FAILED:       10,
    UPGRADE_AVAILABLE:          5,
} as const;

export type BannerId =
    | 'licenseExpired'
    | 'licenseReboundElsewhere'
    | 'invoicePastDue'
    | 'permissionSync'
    | 'connectionSyncFailed'
    | 'connectionSyncWarning'
    | 'connectionFirstSync'
    | 'repositorySyncFailed'
    | 'repositorySyncWarning'
    | 'repositoryFirstSync'
    | 'licenseExpiryHeadsUp'
    | 'trial'
    | 'servicePingFailed'
    | 'upgradeAvailable';

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
    render: (props: BannerProps) => ReactNode;
}

export const DISMISS_COOKIE_PREFIX = 'banner_dismissed_';
