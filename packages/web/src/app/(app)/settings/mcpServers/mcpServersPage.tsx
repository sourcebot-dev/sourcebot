'use client';

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Settings2Icon, ServerIcon } from "lucide-react";
import { getMcpServersWithStatus } from "@/app/api/(client)/client";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectMcpButton } from "@/ee/features/mcp/components/connectMcpButton";
import { McpFavicon } from "@/ee/features/mcp/components/mcpFavicon";
import { mcpQueryKeys } from "@/ee/features/mcp/queryKeys";
import { isServiceError } from "@/lib/utils";

function clearCallbackParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('status');
    url.searchParams.delete('server');
    url.searchParams.delete('message');
    window.history.replaceState({}, '', url.toString());
}

interface McpServersPageProps {
    callbackStatus?: string;
    callbackServer?: string;
    callbackMessage?: string;
    canManageMcpServers: boolean;
}

export function McpServersEmptyState({ canManageMcpServers }: { canManageMcpServers: boolean }) {
    return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-3 mb-4">
                    <ServerIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                    {canManageMcpServers ? "No MCP servers configured yet" : "No MCP servers available"}
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                    {canManageMcpServers
                        ? "Go to Workspace MCP Configuration to add servers before connecting them to Ask Sourcebot."
                        : "No MCP servers have been approved for this workspace yet. Contact your workspace admin."}
                </p>
                {canManageMcpServers && (
                    <Button asChild variant="outline" className="mt-4">
                        <Link href="/settings/mcpConfiguration">
                            <Settings2Icon className="h-4 w-4 mr-2" />
                            Open MCP Configuration
                        </Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

export function McpServersPage({ callbackStatus, callbackServer, callbackMessage, canManageMcpServers }: McpServersPageProps) {
    const { toast } = useToast();
    const didHandleCallbackRef = useRef(false);

    useEffect(() => {
        if (didHandleCallbackRef.current) {
            return;
        }
        if (callbackStatus === 'connected') {
            didHandleCallbackRef.current = true;
            toast({ description: `Successfully connected${callbackServer ? ` to ${callbackServer}` : ''}.` });
            clearCallbackParams();
        } else if (callbackStatus === 'error') {
            didHandleCallbackRef.current = true;
            toast({ title: "Connection failed", description: callbackMessage ?? 'Failed to connect MCP server.', variant: "destructive" });
            clearCallbackParams();
        }
    }, [callbackStatus, callbackServer, callbackMessage, toast]);

    const { data: servers = [], isLoading, isError } = useQuery({
        queryKey: mcpQueryKeys.serversWithStatus,
        queryFn: async () => {
            const result = await getMcpServersWithStatus();
            if (isServiceError(result)) {
                throw new Error("Failed to load MCP servers");
            }
            return result;
        },
    });

    if (isError) {
        return <div>Error loading MCP servers</div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">MCP Servers</h3>
                <p className="text-sm text-muted-foreground max-w-lg">
                    Connect to workspace-approved MCP servers to use them with Ask Sourcebot.
                </p>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <Card key={index}>
                            <CardHeader>
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-4 w-72 mt-1" />
                            </CardHeader>
                            <CardFooter className="flex justify-end">
                                <Skeleton className="h-9 w-36" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : servers.length === 0 ? (
                <McpServersEmptyState canManageMcpServers={canManageMcpServers} />
            ) : (
                <div className="space-y-4">
                    {servers.map((server) => (
                        <Card key={server.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <McpFavicon faviconUrl={server.faviconUrl} className="w-5 h-5 shrink-0" />
                                        <div className="min-w-0">
                                            <CardTitle className="truncate">{server.name || server.serverUrl}</CardTitle>
                                            <CardDescription className="truncate">{server.serverUrl}</CardDescription>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0 pb-2">
                                {server.isConnected && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-green-500" />
                                        <span className="text-xs text-muted-foreground">Connected</span>
                                    </div>
                                )}
                                {server.isAuthExpired && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                                        <span className="text-xs text-yellow-600 dark:text-yellow-400">Authorization expired</span>
                                    </div>
                                )}
                                {!server.isConnected && !server.isAuthExpired && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Not connected</span>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="flex justify-end">
                                <ConnectMcpButton
                                    serverId={server.id}
                                    isConnected={server.isConnected}
                                    isAuthExpired={server.isAuthExpired}
                                />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
