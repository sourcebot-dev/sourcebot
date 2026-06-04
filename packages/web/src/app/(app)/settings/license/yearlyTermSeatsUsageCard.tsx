'use client';

import { Info } from "lucide-react";
import { ReactNode, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/hooks/use-toast";
import { refreshLicense } from "@/ee/features/lighthouse/actions";
import { cn, isServiceError } from "@/lib/utils";
import { SettingsCard } from "../components/settingsCard";
import { YearlyTermStatus } from "./types";

const DOCS_URL = "https://docs.sourcebot.dev/docs/seat-reconciliation";


interface YearlyTermSeatsUsageCardProps {
    currentUsers: number;
    status: YearlyTermStatus;
}

export function YearlyTermSeatsUsageCard({
    currentUsers,
    status: {
        committedSeats,
        peakSeats,
        overageSeats,
        billableOverageSeats,
        currentQuarterNumber,
        totalQuartersInTerm,
        currentQuarterEndsAt,
        termEndsAt,
    }
}: YearlyTermSeatsUsageCardProps) {
    // currentQuarterNumber > totalQuartersInTerm means the final reconciliation
    // has fired but term rollover hasn't (or won't, for canceled subs). See
    // lighthouse `lambda/yearly.ts` for the design note.
    const isTermComplete = currentQuarterNumber > totalQuartersInTerm;

    const router = useRouter();
    const { toast } = useToast();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        refreshLicense()
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to refresh license: ${response.message}`,
                        variant: "destructive",
                    });
                } else {
                    toast({ description: "License refreshed." });
                    router.refresh();
                }
            })
            .finally(() => {
                setIsRefreshing(false);
            });
    }, [router, toast]);

    const hasOverage = billableOverageSeats > 0;
    const percentPerPeakSeat = peakSeats > 0 ? 100 / peakSeats : 0;
    const committedUsedPercent = hasOverage
        ? committedSeats * percentPerPeakSeat
        : committedSeats > 0
            ? Math.min(100, (currentUsers / committedSeats) * 100)
            : 0;
    const overagePercent = hasOverage ? overageSeats * percentPerPeakSeat : 0;

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="text-lg font-medium">Usage</h3>
                <p className="text-sm text-muted-foreground">
                    Track your organization&apos;s seat usage and any pending overage charges for the current subscription term, ending on {formatDate(termEndsAt)}.{" "}
                    <a
                        href={DOCS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-link"
                    >
                        Learn more
                    </a>
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <SettingsCard>
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-semibold">
                                    {currentUsers} / {committedSeats}
                                </p>
                                {billableOverageSeats > 0 ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-help">
                                                Bill pending
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            You&apos;ll be invoiced for {billableOverageSeats} additional {billableOverageSeats === 1 ? 'seat' : 'seats'} at the end of the current quarter on {formatDate(currentQuarterEndsAt)}.
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    overageSeats > 0 &&
                                    billableOverageSeats === 0 &&
                                    (currentUsers - committedSeats) > 0
                                ) ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            {overageSeats === 1
                                                ? `The additional seat in use will not be billed in the current subscription term. Instead, it will be billed upon renewal on ${formatDate(termEndsAt)}.`
                                                : `The ${overageSeats} additional seats in use will not be billed in the current subscription term. Instead, they will be billed upon renewal on ${formatDate(termEndsAt)}.`}
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            {(committedSeats - currentUsers) > 0
                                                ? `${committedSeats - currentUsers} of ${committedSeats} seats remaining. `
                                                : `All ${committedSeats} seats are in use. `}
                                            Additional users will be billed as overage at the end of each quarter.
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
                                <div
                                    className="h-full transition-all bg-primary"
                                    style={{ width: `${committedUsedPercent}%` }}
                                />
                                {overagePercent > 0 && (
                                    <div
                                        className="h-full transition-all bg-blue-400"
                                        style={{ width: `${overagePercent}%` }}
                                    />
                                )}
                            </div>
                            <LabelWithInfo
                                label="Seats in use / Seats in subscription"
                                tooltip={
                                    <div className="flex flex-col gap-2">
                                        <p>
                                            <span className="font-semibold">Seats in use:</span>{" "}
                                            the number of users in your organization right now.
                                        </p>
                                        <p>
                                            <span className="font-semibold">Seats in subscription:</span>{" "}
                                            the seats you&apos;ve paid for so far in your current subscription term.
                                        </p>
                                    </div>
                                }
                                labelClassName="font-semibold"
                            />
                            {isTermComplete ? (
                                <div className="flex items-center gap-1 mt-1">
                                    <p className="text-xs text-muted-foreground">
                                        Term complete, awaiting renewal.
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="link"
                                        onClick={handleRefresh}
                                        disabled={isRefreshing}
                                        className={cn("text-xs text-link px-0", {
                                            isRefreshing: "text-muted-foreground"
                                        })}
                                    >
                                        Refresh
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Quarter {currentQuarterNumber} of {totalQuartersInTerm} · term ends {formatDate(termEndsAt)}
                                </p>
                            )}
                        </div>
                    </SettingsCard>
                </div>

                <SettingsCard>
                    <div className="flex flex-col gap-3 justify-center h-full">
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-semibold">{peakSeats}</p>
                            <LabelWithInfo
                                label="Max seats used"
                                tooltip="The highest number of users observed in your organization during the subscription term."
                                labelClassName="text-sm"
                            />
                        </div>
                        <div className="flex items-baseline gap-2">
                            <p className={cn(
                                "text-2xl font-semibold",
                            )}>
                                {billableOverageSeats}
                            </p>
                            <LabelWithInfo
                                label={billableOverageSeats === 1 ? 'Seat owed' : 'Seats owed'}
                                tooltip="Users over the seats in your subscription. Charged at quarter end, prorated across remaining quarters."
                                labelClassName="text-sm"
                            />
                        </div>
                    </div>
                </SettingsCard>
            </div>
        </div>
    );
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

interface LabelWithInfoProps {
    label: string;
    tooltip: ReactNode;
    labelClassName?: string;
}

function LabelWithInfo({ label, tooltip, labelClassName }: LabelWithInfoProps) {
    return (
        <div className="inline-flex items-center gap-1.5">
            <p className={cn("text-xs text-muted-foreground", labelClassName)}>{label}</p>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    {tooltip}
                </TooltipContent>
            </Tooltip>
        </div>
    );
}
