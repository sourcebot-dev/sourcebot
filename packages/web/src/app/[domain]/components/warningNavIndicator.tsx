"use client";

import Link from "next/link";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { AlertTriangleIcon } from "lucide-react";
import { useDomain } from "@/hooks/useDomain";
import { getConnections } from "@/actions";
import { useState } from "react";
import { useEffect } from "react";
import { isServiceError } from "@/lib/utils";

interface Warning {
    connectionId?: number;
    connectionName?: string;
}

export const WarningNavIndicator = () => {
    const domain = useDomain();
    const [warnings, setWarnings] = useState<Warning[]>([]);

    useEffect(() => {
        const fetchWarnings = async () => {
            const connections = await getConnections(domain);
            const warnings: Warning[] = [];
            if (!isServiceError(connections)) {
                for (const connection of connections) {
                    const syncStatusMetadata = connection.syncStatusMetadata;
                    if (syncStatusMetadata && typeof syncStatusMetadata === 'object' && ('notFound' in syncStatusMetadata)) {
                        const notFound = syncStatusMetadata.notFound as { users: string[], orgs: string[], repos: string[] };
                        if (notFound.users.length > 0 || notFound.orgs.length > 0 || notFound.repos.length > 0) {
                            warnings.push({ connectionId: connection.id, connectionName: connection.name });
                        }
                    }
                }
            }
            setWarnings(prevWarnings => {
                // Only update if the warnings have actually changed
                const warningsChanged = prevWarnings.length !== warnings.length ||
                    prevWarnings.some((warning, idx) =>
                        warning.connectionId !== warnings[idx]?.connectionId ||
                        warning.connectionName !== warnings[idx]?.connectionName
                    );
                return warningsChanged ? warnings : prevWarnings;
            });
        };

        fetchWarnings();
        const intervalId = setInterval(fetchWarnings, 1000);
        return () => clearInterval(intervalId);
    }, [domain]);

    if (warnings.length === 0) {
        return null;
    }   

    return (
        <Link href={`/${domain}/connections`}>
            <HoverCard>
                <HoverCardTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-full text-yellow-700 dark:text-yellow-400 text-xs font-medium hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors cursor-pointer">
                        <AlertTriangleIcon className="h-4 w-4" />
                        <span>{warnings.length}</span>
                    </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex flex-col gap-4 p-5">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                            <h3 className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Missing References</h3>
                        </div>
                        <p className="text-sm text-yellow-600/90 dark:text-yellow-300/90 leading-relaxed">
                            The following connections have references that could not be found:
                        </p>
                        <div className="flex flex-col gap-2 pl-4">
                            {warnings.slice(0, 10).map(warning => (
                                <Link key={warning.connectionName} href={`/${domain}/connections/${warning.connectionId}`}>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 
                                                rounded-md text-sm text-yellow-700 dark:text-yellow-300 
                                                border border-yellow-200/50 dark:border-yellow-800/50
                                                hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors">
                                        <span className="font-medium">{warning.connectionName}</span>
                                    </div>
                                </Link>
                            ))}
                            {warnings.length > 10 && (
                                <div className="text-sm text-yellow-600/90 dark:text-yellow-300/90 pl-3 pt-1">
                                    And {warnings.length - 10} more...
                                </div>
                            )}
                        </div>
                    </div>
                </HoverCardContent>
            </HoverCard>
        </Link>
    );
};
