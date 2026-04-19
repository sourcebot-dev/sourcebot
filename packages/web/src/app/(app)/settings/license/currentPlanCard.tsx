import { License } from "@sourcebot/db";
import { LicenseStatus } from "@sourcebot/shared";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { SettingsCard } from "../components/settingsCard";
import { PlanActionsMenu } from "./planActionsMenu";

interface CurrentPlanCardProps {
    license: License;
}

export function CurrentPlanCard({ license }: CurrentPlanCardProps) {
    const {
        planName,
        unitAmount,
        currency,
        interval,
        intervalCount,
        seats,
        nextRenewalAt,
        nextRenewalAmount,
    } = license;

    // Require the fields needed to render the plan header. nextRenewalAt is
    // optional here because non-active subscriptions hide the renewal column.
    if (
        !planName
        || unitAmount === null
        || !currency
        || !interval
        || intervalCount === null
    ) {
        return null;
    }

    const monthlyPerSeat = normalizeToMonthly(unitAmount, interval, intervalCount);
    const statusBadge = getStatusBadge(license.status);
    const isActivelyBilling =
        license.status === 'active'
        || license.status === 'trialing'
        || license.status === 'past_due';

    return (
        <SettingsCard>
            <div className="flex items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <p className="font-medium">{planName} plan</p>
                        {statusBadge && (
                            <Badge variant="outline" className={statusBadge.className}>
                                {statusBadge.label}
                            </Badge>
                        )}
                    </div>
                    {monthlyPerSeat !== null ? (
                        <p className="text-sm text-muted-foreground">
                            {formatCurrency(monthlyPerSeat, currency)} per user/mo, billed {formatCadence(interval, intervalCount)}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            {formatCurrency(unitAmount, currency)} per user, billed {formatCadence(interval, intervalCount)}
                        </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <code className="font-mono">sb_act_••••</code>
                        {license.lastSyncAt && (
                            <>
                                <span>·</span>
                                <span>Refreshed {formatDistanceToNow(license.lastSyncAt, { addSuffix: true })}</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {isActivelyBilling && nextRenewalAt && (
                        <div className="flex items-center gap-12">
                            <div className="flex flex-col items-end">
                                <p className="text-xs text-muted-foreground">Billed seats</p>
                                <p className="text-sm">{seats ?? 0}</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <p className="text-xs text-muted-foreground">Next renewal</p>
                                <p className="text-sm">
                                    {formatCurrency(nextRenewalAmount ?? 0, currency)} on {formatDate(nextRenewalAt)}
                                </p>
                            </div>
                        </div>
                    )}
                    <PlanActionsMenu />
                </div>
            </div>
        </SettingsCard>
    );
}

function normalizeToMonthly(unitAmount: number, interval: string, intervalCount: number): number | null {
    if (interval === 'year') {
        return unitAmount / (12 * intervalCount);
    }
    if (interval === 'month') {
        return unitAmount / intervalCount;
    }
    return null;
}

function formatCurrency(amountCents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amountCents / 100);
}

function formatCadence(interval: string, intervalCount: number): string {
    if (intervalCount === 1) {
        if (interval === 'year') {
            return 'annually';
        }
        if (interval === 'month') {
            return 'monthly';
        }
        if (interval === 'week') {
            return 'weekly';
        }
        if (interval === 'day') {
            return 'daily';
        }
    }
    if (interval === 'month' && intervalCount === 3) {
        return 'quarterly';
    }
    if (interval === 'month' && intervalCount === 6) {
        return 'semi-annually';
    }
    return `every ${intervalCount} ${interval}s`;
}

const STATUS_BADGES: Record<LicenseStatus, { label: string; className: string }> = {
    active: { label: 'Current', className: 'border-primary/30 text-primary' },
    trialing: { label: 'Trial', className: 'border-primary/30 text-primary' },
    past_due: { label: 'Past due', className: 'border-destructive/30 text-destructive' },
    unpaid: { label: 'Unpaid', className: 'border-destructive/30 text-destructive' },
    incomplete: { label: 'Incomplete', className: 'border-destructive/30 text-destructive' },
    canceled: { label: 'Canceled', className: 'border-muted-foreground/30 text-muted-foreground' },
    incomplete_expired: { label: 'Expired', className: 'border-muted-foreground/30 text-muted-foreground' },
    paused: { label: 'Paused', className: 'border-muted-foreground/30 text-muted-foreground' },
};

function getStatusBadge(status: string | null): { label: string; className: string } | null {
    if (status && status in STATUS_BADGES) {
        return STATUS_BADGES[status as LicenseStatus];
    }
    return null;
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

