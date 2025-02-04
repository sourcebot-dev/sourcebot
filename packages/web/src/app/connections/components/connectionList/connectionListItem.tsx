import { Button } from "@/components/ui/button";
import { getDisplayTime } from "@/lib/utils";
import Link from "next/link";
import { useMemo } from "react";
import { ConnectionIcon } from "../connectionIcon";
import { ConnectionSyncStatus } from "@sourcebot/db";
import { StatusIcon } from "../statusIcon";


const convertSyncStatus = (status: ConnectionSyncStatus) => {
    switch (status) {
        case ConnectionSyncStatus.SYNC_NEEDED:
            return 'waiting';
        case ConnectionSyncStatus.IN_SYNC_QUEUE:
        case ConnectionSyncStatus.SYNCING:
            return 'running';
        case ConnectionSyncStatus.SYNCED:
            return 'succeeded';
        case ConnectionSyncStatus.FAILED:
            return 'failed';
    }
}

interface ConnectionListItemProps {
    id: string;
    name: string;
    type: string;
    status: ConnectionSyncStatus;
    editedAt: Date;
    syncedAt?: Date;
}

export const ConnectionListItem = ({
    id,
    name,
    type,
    status,
    editedAt,
    syncedAt,
}: ConnectionListItemProps) => {
    const statusDisplayName = useMemo(() => {
        switch (status) {
            case ConnectionSyncStatus.SYNC_NEEDED:
                return 'Waiting...';
            case ConnectionSyncStatus.IN_SYNC_QUEUE:
            case ConnectionSyncStatus.SYNCING:
                return 'Syncing...';
            case ConnectionSyncStatus.SYNCED:
                return 'Synced';
            case ConnectionSyncStatus.FAILED:
                return 'Sync failed';
        }
    }, [status]);

    return (
        <Link href={`/connections/${id}`}>
            <div
                className="flex flex-row justify-between items-center border p-4 rounded-lg cursor-pointer bg-background"
            >
                <div className="flex flex-row items-center gap-3">
                    <ConnectionIcon
                        type={type}
                        className="w-8 h-8"
                    />
                    <div className="flex flex-col">
                        <p className="font-medium">{name}</p>
                        <span className="text-sm text-muted-foreground">{`Edited ${getDisplayTime(editedAt)}`}</span>
                    </div>
                </div>
                <div className="flex flex-row items-center">
                    <StatusIcon
                        status={convertSyncStatus(status)}
                        className="w-4 h-4 mr-1"
                    />
                    <p className="text-sm">
                        <span>{statusDisplayName}</span>
                        {
                            (
                                status === ConnectionSyncStatus.SYNCED ||
                                status === ConnectionSyncStatus.FAILED
                            ) && syncedAt && (
                                <span>{` ${getDisplayTime(syncedAt)}`}</span>
                            )
                        }
                    </p>
                    <Button
                        variant="outline"
                        size={"sm"}
                        className="ml-4"
                    >
                        Manage
                    </Button>
                </div>
            </div>
        </Link>
    )
}
