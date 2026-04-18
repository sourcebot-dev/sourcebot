import { License } from "@sourcebot/db";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { SettingsCard } from "../components/settingsCard";
import { PlanActionsMenu } from "./planActionsMenu";

interface CurrentPlanCardProps {
    license: License;
}

export function CurrentPlanCard({ license }: CurrentPlanCardProps) {
    if (
        license.status !== 'active'
        && license.status !== 'trialing'
        && license.status !== 'past_due'
    ) {
        return null;
    }

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

    if (
        !planName
        || unitAmount === null
        || !currency
        || !interval
        || intervalCount === null
        || !nextRenewalAt
    ) {
        return null;
    }

    const monthlyPerSeat = normalizeToMonthly(unitAmount, interval, intervalCount);

    return (
        <SettingsCard>
            <div className="flex items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <p className="font-medium">{planName} plan</p>
                        <Badge variant="outline" className="border-primary/30 text-primary">
                            Current
                        </Badge>
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
                    {license.lastSyncAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Refreshed {formatDistanceToNow(license.lastSyncAt, { addSuffix: true })}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-12">
                        <div className="flex flex-col items-end">
                            <p className="text-xs text-muted-foreground">Users</p>
                            <p className="text-sm">{seats ?? 0}</p>
                        </div>
                        <div className="flex flex-col items-end">
                            <p className="text-xs text-muted-foreground">Next renewal</p>
                            <p className="text-sm">
                                {formatCurrency(nextRenewalAmount ?? 0, currency)} on {formatDate(nextRenewalAt)}
                            </p>
                        </div>
                    </div>
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

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

