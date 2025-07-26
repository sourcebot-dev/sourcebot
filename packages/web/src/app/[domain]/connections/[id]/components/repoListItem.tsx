'use client';

import { getDisplayTime, getRepoImageSrc } from "@/lib/utils";
import Image from "next/image";
import { StatusIcon } from "../../components/statusIcon";
import { RepoIndexingStatus } from "@sourcebot/db";
import { useMemo } from "react";
import { RetryRepoIndexButton } from "./repoRetryIndexButton";


interface RepoListItemProps {
    name: string;
    status: RepoIndexingStatus;
    imageUrl?: string;
    indexedAt?: Date;
    repoId: number;
    domain: string;
}

export const RepoListItem = ({
    imageUrl,
    name,
    indexedAt,
    status,
    repoId,
    domain,
}: RepoListItemProps) => {
    const statusDisplayName = useMemo(() => {
        switch (status) {
            case RepoIndexingStatus.NEW:
                return 'Waiting...';
            case RepoIndexingStatus.IN_INDEX_QUEUE:
                return 'In index queue...';
            case RepoIndexingStatus.INDEXING:
                return 'Indexing...';
            case RepoIndexingStatus.INDEXED:
                return 'Indexed';
            case RepoIndexingStatus.FAILED:
                return 'Index failed';
            case RepoIndexingStatus.IN_GC_QUEUE:
                return 'In garbage collection queue...';
            case RepoIndexingStatus.GARBAGE_COLLECTING:
                return 'Garbage collecting...';
            case RepoIndexingStatus.GARBAGE_COLLECTION_FAILED:
                return 'Garbage collection failed';
        }
    }, [status]);

    const imageSrc = getRepoImageSrc(imageUrl, repoId, domain);

    return (
        <div
            className="flex flex-row items-center p-4 border rounded-lg bg-background justify-between"
        >
            <div className="flex flex-row items-center gap-2">
                {imageSrc ? (
                    <Image
                        src={imageSrc}
                        alt={name}
                        width={32}
                        height={32}
                        className="object-cover"
                    />
                ) : (
                    <div className="h-8 w-8 flex items-center justify-center bg-muted text-xs font-medium uppercase text-muted-foreground rounded-md">
                        {name.charAt(0)}
                    </div>
                )}
                <p className="font-medium">{name}</p>
            </div>
            <div className="flex flex-row items-center gap-4">
                {status === RepoIndexingStatus.FAILED && (
                    <RetryRepoIndexButton repoId={repoId} domain={domain} />
                )}
                <div className="flex flex-row items-center gap-0">
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
        case RepoIndexingStatus.IN_GC_QUEUE:
        case RepoIndexingStatus.GARBAGE_COLLECTING:
            return "garbage-collecting"
        case RepoIndexingStatus.INDEXED:
            return 'succeeded';
        case RepoIndexingStatus.GARBAGE_COLLECTION_FAILED:
        case RepoIndexingStatus.FAILED:
            return 'failed';
    }
}