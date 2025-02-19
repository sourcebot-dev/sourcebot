import { Button } from "@/components/ui/button";
import { getDisplayTime } from "@/lib/utils";
import { useMemo } from "react";
import { ConnectionIcon } from "../connectionIcon";
import { ConnectionSyncStatus, Prisma } from "@sourcebot/db";
import { StatusIcon } from "../statusIcon";
import { AlertTriangle, CircleX} from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

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

    console.log(`Connection ${name} has ${failedRepos?.length} failed repos`);

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
                {failedRepos && failedRepos.length > 0 && (
                    <HoverCard openDelay={50}>
                        <HoverCardTrigger asChild>
                            <CircleX 
                                className="h-5 w-5 text-red-700 dark:text-red-400 cursor-help hover:text-red-600 dark:hover:text-red-300 transition-colors" 
                                onClick={() => window.location.href = `connections/${id}`}
                            />
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex flex-col space-y-3">
                                <div className="flex items-center gap-2 pb-2 border-b border-red-200 dark:border-red-800">
                                    <CircleX className="h-4 w-4 text-red-700 dark:text-red-400" />
                                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Failed to Index Repositories</h3>
                                </div>
                                <div className="text-sm text-red-600/90 dark:text-red-300/90 space-y-3">
                                    <p>
                                        {failedRepos.length} {failedRepos.length === 1 ? 'repository' : 'repositories'} failed to index. This is likely due to temporary server load.
                                    </p>
                                    <div className="space-y-2 text-sm bg-red-50 dark:bg-red-900/20 rounded-md p-3 border border-red-200/50 dark:border-red-800/50">
                                        <span className="text-red-700 dark:text-red-300">{failedRepos.map(repo => repo.repoName).join(', ')}</span>
                                    </div>
                                    <p className="text-xs">
                                        Navigate to the connection for more details and to retry indexing.
                                    </p>
                                </div>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                )}
                {(notFoundData && displayNotFoundWarning) && (
                    <HoverCard openDelay={50}>
                        <HoverCardTrigger asChild>
                            <AlertTriangle 
                                className="h-5 w-5 text-yellow-700 dark:text-yellow-400 cursor-help hover:text-yellow-600 dark:hover:text-yellow-300 transition-colors" 
                                onClick={() => window.location.href = `connections/${id}`}
                            />
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <div className="flex flex-col space-y-3">
                                <div className="flex items-center gap-2 pb-2 border-b border-yellow-200 dark:border-yellow-800">
                                    <AlertTriangle className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
                                    <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Unable to fetch all references</h3>
                                </div>
                                <p className="text-sm text-yellow-600/90 dark:text-yellow-300/90">
                                    Some requested references couldn&apos;t be found. Verify the details below and ensure your connection is using a {" "}
                                    <button 
                                        onClick={() => window.location.href = `secrets`} 
                                        className="font-medium text-yellow-700 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-colors"
                                    >
                                        valid access token
                                    </button>{" "}
                                    that has access to any private references.
                                </p>
                                <ul className="space-y-2 text-sm bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-3 border border-yellow-200/50 dark:border-yellow-800/50">
                                    {notFoundData.users.length > 0 && (
                                        <li className="flex items-center gap-2">
                                            <span className="font-medium text-yellow-700 dark:text-yellow-400">Users:</span>
                                            <span className="text-yellow-700 dark:text-yellow-300">{notFoundData.users.join(', ')}</span>
                                        </li>
                                    )}
                                    {notFoundData.orgs.length > 0 && (
                                        <li className="flex items-center gap-2">
                                            <span className="font-medium text-yellow-700 dark:text-yellow-400">{type === "gitlab" ? "Groups" : "Organizations"}:</span>
                                            <span className="text-yellow-700 dark:text-yellow-300">{notFoundData.orgs.join(', ')}</span>
                                        </li>
                                    )}
                                    {notFoundData.repos.length > 0 && (
                                        <li className="flex items-center gap-2">
                                            <span className="font-medium text-yellow-700 dark:text-yellow-400">{type === "gitlab" ? "Projects" : "Repositories"}:</span>
                                            <span className="text-yellow-700 dark:text-yellow-300">{notFoundData.repos.join(', ')}</span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                )}
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
                    onClick={() => window.location.href = `connections/${id}`}
                >
                    Manage
                </Button>
            </div>
        </div>
    )
}
