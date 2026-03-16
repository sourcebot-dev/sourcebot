'use client';

import { useEffect, useState } from "react";
import { getAuthProviderInfo, unwrapServiceError } from "@/lib/utils";
import { AlertCircle, ArrowUpRight, ChevronDown, Loader2, RefreshCw, Unlink } from "lucide-react";
import { ProviderIcon } from "./providerIcon";
import { LinkedAccount } from "@/ee/features/sso/actions";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { unlinkLinkedAccountProvider } from "@/ee/features/sso/actions";
import { triggerAccountPermissionSync } from "@/features/workerApi/actions";
import { isServiceError } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/hooks/use-toast";
import { signIn } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getAccountSyncStatus } from "@/app/api/(client)/client";

interface LinkedAccountProviderCardProps {
    linkedAccount: LinkedAccount;
    callbackUrl?: string;
}

export function LinkedAccountProviderCard({
    linkedAccount,
    callbackUrl,
}: LinkedAccountProviderCardProps) {
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [syncJobId, setSyncJobId] = useState<string | null>(null);
    const router = useRouter();
    const { toast } = useToast();

    const providerInfo = getAuthProviderInfo(linkedAccount.provider);

    const { data: syncStatusData } = useQuery({
        queryKey: ["accountSyncStatus", syncJobId],
        queryFn: () => unwrapServiceError(getAccountSyncStatus(syncJobId!)),
        enabled: !!syncJobId,
        refetchInterval: 1000,
    });

    const isSyncing = !!syncJobId && (syncStatusData?.isSyncing ?? true);

    useEffect(() => {
        if (syncJobId && syncStatusData !== undefined && !syncStatusData.isSyncing) {
            setSyncJobId(null);
            toast({ description: `✅ Permissions refreshed for ${providerInfo.displayName}.` });
            router.refresh();
        }
    }, [syncJobId, syncStatusData, providerInfo.displayName, toast, router]);

    const handleConnect = () => {
        signIn(linkedAccount.provider, { redirectTo: callbackUrl ?? window.location.href });
    };

    const handleDisconnect = async () => {
        setIsDisconnecting(true);
        try {
            const result = await unlinkLinkedAccountProvider(linkedAccount.provider);
            if (isServiceError(result)) {
                toast({
                    description: `❌ Failed to disconnect ${providerInfo.displayName}. ${result.message}`,
                    variant: "destructive",
                });
                return;
            }
            toast({ description: `✅ ${providerInfo.displayName} disconnected.` });
            router.refresh();
        } catch (error) {
            toast({
                description: `❌ Failed to disconnect. ${error instanceof Error ? error.message : "Unknown error"}`,
                variant: "destructive",
            });
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleRefreshPermissions = async () => {
        if (!linkedAccount.accountId) return;
        try {
            const result = await triggerAccountPermissionSync(linkedAccount.accountId);
            if (isServiceError(result)) {
                toast({
                    description: `❌ Failed to refresh permissions. ${result.message}`,
                    variant: "destructive",
                });
                return;
            }
            setSyncJobId(result.jobId);
        } catch (error) {
            toast({
                description: `❌ Failed to refresh permissions. ${error instanceof Error ? error.message : "Unknown error"}`,
                variant: "destructive",
            });
        }
    };

    const isBusy = isDisconnecting || isSyncing;

    return (
        <div className="flex items-center justify-between px-4 py-3 border border-border rounded-lg bg-card">
            <div className="flex items-center gap-3">
                <ProviderIcon
                    icon={providerInfo.icon}
                    displayName={providerInfo.displayName}
                    size="md"
                />
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{providerInfo.displayName}</span>
                        {linkedAccount.required && (
                            <Badge variant="default" className="text-xs font-medium">Required</Badge>
                        )}
                    </div>
                    {linkedAccount.isLinked && linkedAccount.providerAccountId && (
                        <span className="text-xs text-muted-foreground font-mono">
                            {linkedAccount.providerAccountId}
                        </span>
                    )}
                    {linkedAccount.error && (
                        <span className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Token refresh failed — please reconnect
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-shrink-0">
                {linkedAccount.isLinked ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={isBusy} className="gap-1.5">
                                {isSyncing
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <span className="h-2 w-2 rounded-full bg-green-500" />
                                }
                                {isDisconnecting ? "Disconnecting..." : isSyncing ? "Syncing..." : "Connected"}
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {linkedAccount.supportsPermissionSync && linkedAccount.accountId && (
                                <DropdownMenuItem onClick={handleRefreshPermissions}>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Refresh Permissions
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={handleDisconnect}
                                className="text-destructive focus:text-destructive"
                            >
                                <Unlink className="h-4 w-4 mr-2" />
                                Disconnect...
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                ) : (
                    <Button variant="ghost" size="sm" onClick={handleConnect} className="gap-1">
                        Connect
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>
        </div>
    );
}
