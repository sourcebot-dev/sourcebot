'use client'

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AlertTriangle } from "lucide-react";
import { NotFoundData } from "@/lib/syncStatusMetadataSchema";
import useCaptureEvent from "@/hooks/useCaptureEvent";


interface ConnectionListItemWarningIndicatorProps {
    notFoundData: NotFoundData | null;
    connectionId: string;
    type: string;
    displayWarning: boolean;
}

export const ConnectionListItemWarningIndicator = ({
    notFoundData,
    connectionId,
    type,
    displayWarning
}: ConnectionListItemWarningIndicatorProps) => {
    const captureEvent = useCaptureEvent()
    
    if (!notFoundData || !displayWarning) return null;

    return (
        <HoverCard openDelay={50}>
            <HoverCardTrigger asChild>
                <AlertTriangle 
                    className="h-5 w-5 text-yellow-700 dark:text-yellow-400 cursor-help hover:text-yellow-600 dark:hover:text-yellow-300 transition-colors" 
                    onClick={() => {
                        captureEvent('wa_connection_list_item_warning_pressed', {})
                        window.location.href = `connections/${connectionId}`
                    }}
                    onMouseEnter={() => captureEvent('wa_connection_list_item_warning_hover', {})}
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
    );
}; 