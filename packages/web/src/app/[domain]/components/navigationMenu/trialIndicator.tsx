"use client";

import Link from "next/link";
import { useDomain } from "@/hooks/useDomain";
import { isServiceError } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { ServiceError } from "@/lib/serviceError";

interface Props {
    subscription: {
        status: string;
        nextBillingDate: number;
    } | null | ServiceError;
}

export const TrialIndicator = ({ subscription }: Props) => {
    const domain = useDomain();
    const captureEvent = useCaptureEvent();

    if (isServiceError(subscription)) {
        captureEvent('wa_trial_nav_subscription_fetch_fail', {
            errorCode: subscription.errorCode,
        });
        return null;
    }

    if (!subscription || subscription.status !== "trialing") {
        return null;
    }

    return (
        <Link href={`/${domain}/upgrade`} onClick={() => captureEvent('wa_trial_nav_pressed', {})}>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-full text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer">
                <span className="inline-block w-2 h-2 bg-blue-400 dark:bg-blue-500 rounded-full"></span>
                <span>
                    {Math.ceil((subscription.nextBillingDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24))} days left in trial
                </span>
            </div>
        </Link>
    );
};
