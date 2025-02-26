'use client';

import { AlertTriangle } from "lucide-react"
import { Prisma, ConnectionSyncStatus } from "@sourcebot/db"
import { RetrySyncButton } from "./retrySyncButton"
import { SyncStatusMetadataSchema } from "@/lib/syncStatusMetadataSchema"
import useCaptureEvent from "@/hooks/useCaptureEvent";

interface NotFoundWarningProps {
    syncStatus: ConnectionSyncStatus
    syncStatusMetadata: Prisma.JsonValue
    onSecretsClick: () => void
    connectionId: number
    domain: string
    connectionType: string
}

export const NotFoundWarning = ({ syncStatus, syncStatusMetadata, onSecretsClick, connectionId, domain, connectionType }: NotFoundWarningProps) => {
    const captureEvent = useCaptureEvent();

    const parseResult = SyncStatusMetadataSchema.safeParse(syncStatusMetadata);
    if (syncStatus !== ConnectionSyncStatus.SYNCED_WITH_WARNINGS || !parseResult.success || !parseResult.data.notFound) {
        return null;
    }

    const { notFound } = parseResult.data;

    if (notFound.users.length === 0 && notFound.orgs.length === 0 && notFound.repos.length === 0) {
        return null;
    } else {
        captureEvent('wa_connection_not_found_warning_displayed', {});
    }

    return (
        <div className="flex flex-col items-start gap-4 border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-5 py-5 text-yellow-700 dark:text-yellow-400 rounded-lg">
            <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <h3 className="font-semibold">Unable to fetch all references</h3>
            </div>
            <p className="text-sm text-yellow-600/90 dark:text-yellow-300/90 leading-relaxed">
                Some requested references couldn&apos;t be found. Please ensure you&apos;ve provided the information listed below correctly, and that you&apos;ve provided a{" "}
                <button onClick={onSecretsClick} className="text-yellow-500 dark:text-yellow-400 font-bold hover:underline">
                    valid token
                </button>{" "}
                to access them if they&apos;re private.
            </p>
            <ul className="w-full space-y-2 text-sm">
                {notFound.users.length > 0 && (
                    <li className="flex items-center gap-2 px-3 py-2 bg-yellow-100/50 dark:bg-yellow-900/30 rounded-md border border-yellow-200/50 dark:border-yellow-800/50">
                        <span className="font-medium">Users:</span>
                        <span className="text-yellow-600 dark:text-yellow-300">{notFound.users.join(', ')}</span>
                    </li>
                )}
                {notFound.orgs.length > 0 && (
                    <li className="flex items-center gap-2 px-3 py-2 bg-yellow-100/50 dark:bg-yellow-900/30 rounded-md border border-yellow-200/50 dark:border-yellow-800/50">
                        <span className="font-medium">{connectionType === "gitlab" ? "Groups" : "Organizations"}:</span>
                        <span className="text-yellow-600 dark:text-yellow-300">{notFound.orgs.join(', ')}</span>
                    </li>
                )}
                {notFound.repos.length > 0 && (
                    <li className="flex items-center gap-2 px-3 py-2 bg-yellow-100/50 dark:bg-yellow-900/30 rounded-md border border-yellow-200/50 dark:border-yellow-800/50">
                        <span className="font-medium">{connectionType === "gitlab" ? "Projects" : "Repositories"}:</span>
                        <span className="text-yellow-600 dark:text-yellow-300">{notFound.repos.join(', ')}</span>
                    </li>
                )}
            </ul>
            <div className="w-full flex justify-center">
                <RetrySyncButton connectionId={connectionId} domain={domain} />
            </div>
        </div>
    )
}
