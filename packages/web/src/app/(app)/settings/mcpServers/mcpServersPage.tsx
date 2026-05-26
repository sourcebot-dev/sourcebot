'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MoreHorizontal, SearchIcon, ServerIcon, Settings2Icon, Unplug } from "lucide-react";
import { getMcpServersWithStatus } from "@/app/api/(client)/client";
import { useToast } from "@/components/hooks/use-toast";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectMcpButton } from "@/ee/features/mcp/components/connectMcpButton";
import { McpFavicon } from "@/ee/features/mcp/components/mcpFavicon";
import { useConnectMcp } from "@/ee/features/mcp/hooks/useConnectMcp";
import { disconnectMcpServer } from "@/ee/features/mcp/actions";
import { invalidateMcpConfigurationQueries, mcpQueryKeys } from "@/ee/features/mcp/queryKeys";
import { cn, isServiceError } from "@/lib/utils";

type FilterTab = "all" | "connected";

function displayUrl(url: string) {
    return url.replace(/^https?:\/\//, "");
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
    return count === 1 ? singular : plural;
}

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
    const queryClient = useQueryClient();
    const didHandleCallbackRef = useRef(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<FilterTab>("all");
    const [disconnectingServerId, setDisconnectingServerId] = useState<string | null>(null);
    const [confirmDisconnectServer, setConfirmDisconnectServer] = useState<{ id: string; name: string } | null>(null);
    const { connect: reconnectMcp } = useConnectMcp();

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

    const connectedServers = useMemo(
        () => servers.filter((s) => s.isConnected || s.isAuthExpired),
        [servers],
    );

    const suggestedServers = useMemo(
        () => servers.filter((s) => !s.isConnected && !s.isAuthExpired),
        [servers],
    );

    const filteredConnected = useMemo(() => {
        const list = connectedServers;
        if (!searchQuery.trim()) {
            return list;
        }
        const q = searchQuery.toLowerCase();
        return list.filter(
            (s) => (s.name?.toLowerCase().includes(q)) || s.serverUrl.toLowerCase().includes(q),
        );
    }, [connectedServers, searchQuery]);

    const filteredSuggested = useMemo(() => {
        const list = suggestedServers;
        if (!searchQuery.trim()) {
            return list;
        }
        const q = searchQuery.toLowerCase();
        return list.filter(
            (s) => (s.name?.toLowerCase().includes(q)) || s.serverUrl.toLowerCase().includes(q),
        );
    }, [suggestedServers, searchQuery]);

    const visibleConnected = filteredConnected;
    const visibleSuggested = activeTab === "all" ? filteredSuggested : [];

    const handleDisconnect = async (serverId: string) => {
        setDisconnectingServerId(serverId);
        setConfirmDisconnectServer(null);
        try {
            const result = await disconnectMcpServer(serverId);
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to disconnect: ${result.message}`, variant: "destructive" });
                return;
            }
            toast({ description: "MCP server disconnected." });
            await invalidateMcpConfigurationQueries(queryClient);
        } catch {
            toast({ title: "Error", description: "Failed to disconnect MCP server.", variant: "destructive" });
        } finally {
            setDisconnectingServerId(null);
        }
    };

    if (isError) {
        return <div>Error loading MCP servers</div>;
    }

    if (!isLoading && servers.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h3 className="text-lg font-medium">MCP Servers</h3>
                    <p className="text-sm text-muted-foreground max-w-lg">
                        Connect to workspace-approved MCP servers to use them with Ask Sourcebot.
                    </p>
                </div>
                <McpServersEmptyState canManageMcpServers={canManageMcpServers} />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">MCP Servers</h3>
                <p className="text-sm text-muted-foreground max-w-lg">
                    Connect to workspace-approved MCP servers to use them with Ask Sourcebot.
                </p>
            </div>

            {/* Search + filter bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search servers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
                    <button
                        onClick={() => setActiveTab("all")}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-sm transition-colors",
                            activeTab === "all"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        All
                        <span className="ml-1.5 text-muted-foreground">{servers.length}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("connected")}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-sm transition-colors",
                            activeTab === "connected"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        Connected
                        <span className="ml-1.5 text-muted-foreground">{connectedServers.length}</span>
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Card key={index}>
                            <CardContent className="flex items-center gap-3 p-3">
                                <Skeleton className="h-8 w-8 rounded-lg" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-4 w-36" />
                                    <Skeleton className="h-3 w-56" />
                                </div>
                                <Skeleton className="h-8 w-20" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <>
                    {/* Connected section */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Connected
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {connectedServers.length} {pluralize(connectedServers.length, "server")}
                            </p>
                        </div>

                        {visibleConnected.length === 0 ? (
                            <Card>
                                <CardContent className="flex items-center justify-center py-8">
                                    <p className="text-sm text-muted-foreground">
                                        {searchQuery.trim()
                                            ? "No connected servers match your search."
                                            : "No servers connected yet."}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            visibleConnected.map((server) => (
                                <Card key={server.id}>
                                    <CardContent className="flex items-center gap-3 p-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                            <McpFavicon faviconUrl={server.faviconUrl} className="h-4.5 w-4.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">
                                                {server.name || server.serverUrl}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {displayUrl(server.serverUrl)}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {server.isConnected && (
                                                    <>
                                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500/80" />
                                                        <span className="text-[11px] text-green-600 dark:text-green-400">Connected</span>
                                                    </>
                                                )}
                                                {server.isAuthExpired && (
                                                    <>
                                                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500/80" />
                                                        <span className="text-[11px] text-yellow-600 dark:text-yellow-400">Authorization expired</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Button variant="outline" size="sm" asChild className="h-8">
                                                <a href={server.serverUrl} target="_blank" rel="noopener noreferrer">
                                                    Manage
                                                </a>
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => reconnectMcp(server.id)}>
                                                        <ExternalLink className="h-4 w-4 mr-2" />
                                                        Reconnect
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        disabled={disconnectingServerId === server.id}
                                                        onClick={() => setConfirmDisconnectServer({
                                                            id: server.id,
                                                            name: server.name || server.serverUrl,
                                                        })}
                                                    >
                                                        <Unplug className="h-4 w-4 mr-2" />
                                                        {disconnectingServerId === server.id ? "Disconnecting..." : "Disconnect"}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    {/* Suggested section */}
                    {activeTab === "all" && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Suggested
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    workspace-approved
                                </p>
                            </div>

                            {visibleSuggested.length === 0 ? (
                                <Card>
                                    <CardContent className="flex items-center justify-center py-8">
                                        <p className="text-sm text-muted-foreground">
                                            {searchQuery.trim()
                                                ? "No suggested servers match your search."
                                                : "All servers are connected."}
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                visibleSuggested.map((server) => (
                                    <Card key={server.id}>
                                        <CardContent className="flex items-center gap-3 p-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                                                <McpFavicon faviconUrl={server.faviconUrl} className="h-4.5 w-4.5" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">
                                                    {server.name || server.serverUrl}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {displayUrl(server.serverUrl)}
                                                </p>
                                            </div>
                                            <ConnectMcpButton
                                                serverId={server.id}
                                                isConnected={false}
                                                isAuthExpired={false}
                                                size="sm"
                                            />
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Disconnect confirmation dialog */}
            <AlertDialog
                open={confirmDisconnectServer !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setConfirmDisconnectServer(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect MCP Server</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to disconnect from <span className="font-semibold text-foreground">{confirmDisconnectServer?.name}</span>? Your stored credentials for this server will be removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (confirmDisconnectServer) {
                                    handleDisconnect(confirmDisconnectServer.id);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Disconnect
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
