import { getDisplayTime } from "@/lib/utils";
import { useMemo } from "react";
import { ConnectionIcon } from "../connectionIcon";
import { ConnectionSyncStatus, Prisma } from "@sourcebot/db";
import { StatusIcon } from "../statusIcon";
import { ConnectionListItemErrorIndicator } from "./connectionListItemErrorIndicator";
import { ConnectionListItemWarningIndicator } from "./connectionListItemWarningIndicator";
import { ConnectionListItemManageButton } from "./connectionListItemManageButton";

const convertSyncStatus = (status: ConnectionSyncStatus) => {
    switch (status) {
        case ConnectionSyncStatus.SYNC_NEEDED:
            return 'waiting';
        case ConnectionSyncStatus.IN_SYNC_QUEUE:
        case ConnectionSyncStatus.SYNCING:
            return 'running';
        case ConnectionSyncStatus.SYNCED:
            return 'succeeded';
        case ConnectionSyncStatus.SYNCED_WITH_WARNINGS:
            return 'succeeded-with-warnings';
        case ConnectionSyncStatus.FAILED:
            return 'failed';
    }
}

interface ConnectionListItemProps {
    id: string;
    name: string;
    type: string;
    status: ConnectionSyncStatus;
    syncStatusMetadata: Prisma.JsonValue;
    editedAt: Date;
    syncedAt?: Date;
    failedRepos?: { repoId: number, repoName: string }[];
}

export const ConnectionListItem = ({
    id,
    name,
    type,
    status,
    syncStatusMetadata,
    editedAt,
    syncedAt,
    failedRepos,
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
            case ConnectionSyncStatus.SYNCED_WITH_WARNINGS:
                return null;
        }
    }, [status]);

    const { notFoundData, displayNotFoundWarning } = useMemo(() => {
        if (!syncStatusMetadata || typeof syncStatusMetadata !== 'object' || !('notFound' in syncStatusMetadata)) {
            return { notFoundData: null, displayNotFoundWarning: false };
        }

        const notFoundData = syncStatusMetadata.notFound as {
            users: string[],
            orgs: string[],
            repos: string[],
        }

        return { notFoundData, displayNotFoundWarning: notFoundData.users.length > 0 || notFoundData.orgs.length > 0 || notFoundData.repos.length > 0 };
    }, [syncStatusMetadata]);

    return (
        <div
            className="flex flex-row justify-between items-center border p-4 rounded-lg bg-background"
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
                <ConnectionListItemErrorIndicator failedRepos={failedRepos} connectionId={id} />
                <ConnectionListItemWarningIndicator 
                    notFoundData={notFoundData} 
                    connectionId={id} 
                    type={type}
                    displayWarning={displayNotFoundWarning}
                />
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
                <ConnectionListItemManageButton id={id} />
            </div>
        </div>
    )
}
