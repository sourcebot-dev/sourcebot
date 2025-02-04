import { Connection } from "@sourcebot/db"
import { ConnectionListItem } from "./connectionListItem";
import { cn } from "@/lib/utils";
import { InfoCircledIcon } from "@radix-ui/react-icons";


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
            {connections.length > 0 ? connections
                .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                .map((connection) => (
                    <ConnectionListItem
                        key={connection.id}
                        id={connection.id.toString()}
                        name={connection.name}
                        type={connection.connectionType}
                        status={connection.syncStatus}
                        editedAt={connection.updatedAt}
                        syncedAt={connection.syncedAt ?? undefined}
                    />
                ))
                : (
                    <div className="flex flex-col items-center justify-center border rounded-md p-4 h-full">
                        <InfoCircledIcon className="w-7 h-7" />
                        <h2 className="mt-2 font-medium">No connections</h2>
                    </div>
                )}
        </div>
    )
}