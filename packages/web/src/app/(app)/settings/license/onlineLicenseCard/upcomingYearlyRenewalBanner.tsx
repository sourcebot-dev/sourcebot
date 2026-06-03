"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { createPortalSession } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";

// @note take care to keep this in sync with
// the value in constants.ts in lighthouse.
const YEARLY_CANCELLATION_NOTICE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

interface UpcomingRenewalBannerProps {
    renewalAt: Date;
    seats: number;
}

export function UpcomingYearlyRenewalBanner({ renewalAt, seats }: UpcomingRenewalBannerProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const [nowMs] = useState(() => Date.now());

    const handleCancelClick = useCallback(() => {
        setIsOpeningPortal(true);
        createPortalSession().then((response) => {
            if (isServiceError(response)) {
                toast({
                    description: `Failed to open subscription portal: ${response.message}`,
                    variant: "destructive",
                });
                setIsOpeningPortal(false);
                return;
            }
            router.push(response.url);
        });
    }, [router, toast]);

    const daysUntilRenewal = (renewalAt.getTime() - nowMs) / DAY_MS;
    const noticeDeadlineHasPassed = daysUntilRenewal < YEARLY_CANCELLATION_NOTICE_DAYS;
    const noticeDeadline = new Date(renewalAt.getTime() - YEARLY_CANCELLATION_NOTICE_DAYS * DAY_MS);

    return (
        <div className="flex items-start gap-3 border-t bg-blue-500/10 px-4 py-2.5">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-400" />
            <div className="text-sm">
                <p>
                    <span className="font-medium">
                        Auto-renewing on {formatDate(renewalAt)}
                    </span>{" "}
                    <span className="text-muted-foreground">
                        with {seats} {seats === 1 ? 'seat' : 'seats'}.
                    </span>
                </p>
                {!noticeDeadlineHasPassed && (
                    <p className="text-muted-foreground mt-1">
                        You have until {formatDate(noticeDeadline)} to{" "}
                        <button
                            type="button"
                            onClick={handleCancelClick}
                            disabled={isOpeningPortal}
                            className="text-link hover:underline disabled:opacity-50"
                        >
                            cancel
                        </button>{" "}
                        your subscription or{" "}
                        <a
                            href="mailto:ar@sourcebot.dev"
                            className="text-link hover:underline"
                        >
                            request
                        </a>{" "}
                        a different seat count for renewal.
                    </p>
                )}
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
