"use client";

import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { syncConnection } from "@/features/connections/actions";
import { isServiceError } from "@/lib/utils";
import { EllipsisVertical, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

type ConnectionActionsMenuProps = {
    connection: {
        id: number;
        name: string;
    };
    isSyncing: boolean;
    onSyncScheduled: (connectionId: number, jobId: string) => void;
};

export const ConnectionActionsMenu = ({
    connection,
    isSyncing,
    onSyncScheduled,
}: ConnectionActionsMenuProps) => {
    const [isScheduling, setIsScheduling] = useState(false);
    const { toast } = useToast();

    const scheduleSync = async () => {
        setIsScheduling(true);

        try {
            const response = await syncConnection(connection.id);
            if (isServiceError(response)) {
                toast({
                    variant: "destructive",
                    title: "Failed to sync connection",
                    description: response.message,
                });
                return;
            }

            onSyncScheduled(connection.id, response.jobId);
            toast({
                title: "Sync scheduled",
                description: `${connection.name} was queued for syncing.`,
            });
        } catch {
            toast({
                variant: "destructive",
                title: "Failed to sync connection",
                description: "An unexpected error occurred while scheduling the sync.",
            });
        } finally {
            setIsScheduling(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Open actions for ${connection.name}`}
                >
                    <EllipsisVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    className="gap-2"
                    disabled={isScheduling || isSyncing}
                    onSelect={() => void scheduleSync()}
                >
                    {isScheduling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                    Sync
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
