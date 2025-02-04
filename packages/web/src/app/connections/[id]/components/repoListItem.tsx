import { getDisplayTime } from "@/lib/utils";
import Image from "next/image";
import { StatusIcon } from "../../components/statusIcon";
import { RepoIndexingStatus } from "@sourcebot/db";
import { useMemo } from "react";


interface RepoListItemProps {
    name: string;
    status: RepoIndexingStatus;
    imageUrl?: string;
    indexedAt?: Date;
}

export const RepoListItem = ({
    imageUrl,
    name,
    indexedAt,
    status,
}: RepoListItemProps) => {
    const statusDisplayName = useMemo(() => {
        switch (status) {
            case RepoIndexingStatus.NEW:
                return 'Waiting...';
            case RepoIndexingStatus.IN_INDEX_QUEUE:
            case RepoIndexingStatus.INDEXING:
                return 'Indexing...';
            case RepoIndexingStatus.INDEXED:
                return 'Indexed';
            case RepoIndexingStatus.FAILED:
                return 'Index failed';
        }
    }, [status]);

    return (
        <div
            className="flex flex-row items-center p-4 border rounded-lg bg-background justify-between"
        >
            <div className="flex flex-row items-center gap-2">
                <Image
                    src={imageUrl ?? ""}
                    alt={name}
                    width={40}
                    height={40}
                    className="rounded-full"
                />
                <p className="font-medium">{name}</p>
            </div>
            <div className="flex flex-row items-center">
                <StatusIcon
                    status={convertIndexingStatus(status)}
                    className="w-4 h-4 mr-1"
                />
                <p className="text-sm">
                    <span>{statusDisplayName}</span>
                    {
                        (
                            status === RepoIndexingStatus.INDEXED ||
                            status === RepoIndexingStatus.FAILED
                        ) && indexedAt && (
                            <span>{` ${getDisplayTime(indexedAt)}`}</span>
                        )
                    }
                </p>
            </div>
        </div>
    )
}

const convertIndexingStatus = (status: RepoIndexingStatus) => {
    switch (status) {
        case RepoIndexingStatus.NEW:
            return 'waiting';
        case RepoIndexingStatus.IN_INDEX_QUEUE:
        case RepoIndexingStatus.INDEXING:
            return 'running';
        case RepoIndexingStatus.INDEXED:
            return 'succeeded';
        case RepoIndexingStatus.FAILED:
            return 'failed';
    }
}