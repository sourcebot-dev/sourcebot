import { Button } from "@/components/ui/button";
import { cn, getDisplayTime } from "@/lib/utils";
import placeholderLogo from "@/public/placeholder_avatar.png";
import { Cross2Icon } from "@radix-ui/react-icons";
import { CircleCheckIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { FiLoader } from "react-icons/fi";
import { ConnectionIcon } from "../connectionIcon";

export type SyncStatus = 'waiting' | 'syncing' | 'synced' | 'failed';

interface ConnectionListItemProps {
    id: string;
    name: string;
    type: string;
    status: SyncStatus;
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
            case 'waiting':
                return 'Waiting...';
            case 'syncing':
                return 'Syncing...';
            case 'synced':
                return 'Synced';
            case 'failed':
                return 'Sync failed';
        }
    }, [status]);

    return (
        <Link href={`/connections/${id}`}>
            <div
                className="flex flex-row justify-between items-center border p-4 rounded-lg cursor-pointer bg-background dark:bg-background"
            >
                <div className="flex flex-row items-center gap-3">
                    <ConnectionIcon
                        type={type}
                        className="w-8 h-8"
                    />
                    <div className="flex flex-col">
                        <p className="font-medium">{name}</p>
                        <div className="flex flex-row items-center gap-1.5">
                            <span className="text-sm text-muted-foreground">{`Edited ${getDisplayTime(editedAt)}`}</span>
                            <Image
                                src={placeholderLogo}
                                alt={''}
                                className="rounded-full w-5 h-5"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex flex-row items-center">
                    <StatusIcon status={status} className="w-4 h-4 mr-1" />
                    <p className="text-sm">
                        <span>{statusDisplayName}</span>
                        {
                            (status === 'synced' || status === 'failed') && syncedAt && (
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

const StatusIcon = ({
    status,
    className,
}: { status: SyncStatus, className?: string }) => {
    const Icon = useMemo(() => {
        switch (status) {
            case 'waiting':
            case 'syncing':
                return <FiLoader className={cn('animate-spin-slow', className)} />;
            case 'synced':
                return <CircleCheckIcon className={cn('text-green-600', className)} />;
            case 'failed':
                return <Cross2Icon className={cn(className)} />;
        }
    }, [className, status]);

    return Icon;
}