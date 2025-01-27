import { Connection, ConnectionSyncStatus } from "@sourcebot/db"
import { ConnectionListItem, SyncStatus } from "./connectionListItem";
import { cn } from "@/lib/utils";

const convertSyncStatus = (status: ConnectionSyncStatus): SyncStatus => {
    switch (status) {
        case ConnectionSyncStatus.SYNC_NEEDED:
            return 'waiting';
        case ConnectionSyncStatus.IN_SYNC_QUEUE:
        case ConnectionSyncStatus.SYNCING:
            return 'syncing';
        case ConnectionSyncStatus.SYNCED:
            return 'synced';
        case ConnectionSyncStatus.FAILED:
            return 'failed';
    }
}

interface ConnectionListProps {
    connections: Connection[];
    className?: string;
}

export const ConnectionList = ({
    connections,
    className,
}: ConnectionListProps) => {

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {connections
                .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                .map((connection) => (
                    <ConnectionListItem
                        key={connection.id}
                        id={connection.id.toString()}
                        name={connection.name}
                        type={connection.connectionType}
                        status={convertSyncStatus(connection.syncStatus)}
                        editedAt={connection.updatedAt}
                        syncedAt={connection.syncedAt ?? undefined}
                    />
                ))}
        </div>
    )
}