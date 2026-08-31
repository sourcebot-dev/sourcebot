"use client";

import { badgeVariants } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Info, Loader2 } from "lucide-react";
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

type SyncingPopoverProps = {
    repoDisplayName: string;
    startedAt: number | null;
};

export const SyncingPopover = ({
    repoDisplayName,
    startedAt,
}: SyncingPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(() => Date.now());

    useEffect(() => {
        if (!isOpen || startedAt === null) {
            return;
        }

        const interval = window.setInterval(() => {
            setCurrentTime(Date.now());
        }, DURATION_UPDATE_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [isOpen, startedAt]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            setCurrentTime(Date.now());
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        badgeVariants({ variant: "secondary" }),
                        "shrink-0 cursor-pointer select-none gap-1 rounded-sm hover:shadow-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                    aria-label={`View sync details for ${repoDisplayName}`}
                >
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Syncing
                    <Info className="h-3 w-3" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
                <div className="space-y-2">
                    <p className="text-sm font-medium">Repository syncing</p>
                    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-4 text-xs">
                        <dt className="text-muted-foreground">Job duration</dt>
                        <dd className="text-right font-medium tabular-nums">
                            {startedAt === null
                                ? "Waiting to start"
                                : formatJobDuration(currentTime - startedAt)}
                        </dd>
                    </dl>
                </div>
            </PopoverContent>
        </Popover>
    );
};
