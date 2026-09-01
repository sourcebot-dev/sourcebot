"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const DURATION_UPDATE_INTERVAL_MS = 1_000;

const formatJobDuration = (durationMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor(totalSeconds / 3_600) % 24;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const seconds = totalSeconds % 60;

    return [
        days > 0 ? `${days}d` : null,
        days > 0 || hours > 0 ? `${hours}h` : null,
        days > 0 || hours > 0 || minutes > 0 ? `${minutes}m` : null,
        `${seconds}s`,
    ].filter(Boolean).join(" ");
};

type SyncingBadgeProps = {
    startedAt: number | null;
};

export const SyncingBadge = ({ startedAt }: SyncingBadgeProps) => {
    const [currentTime, setCurrentTime] = useState(() => Date.now());

    useEffect(() => {
        if (startedAt === null) {
            return;
        }

        setCurrentTime(Date.now());
        const interval = window.setInterval(() => {
            setCurrentTime(Date.now());
        }, DURATION_UPDATE_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [startedAt]);

    return (
        <Badge variant="secondary" className="shrink-0 gap-1 rounded-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            {startedAt === null
                ? <span>Pending</span>
                : (
                    <>
                        <span>Syncing</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                            {formatJobDuration(currentTime - startedAt)}
                        </span>
                    </>
                )}
        </Badge>
    );
};
