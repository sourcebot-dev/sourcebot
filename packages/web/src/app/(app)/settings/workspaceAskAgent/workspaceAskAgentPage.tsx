'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMcpConfiguration, getMcpServersWithStatus } from "@/app/api/(client)/client";
import { useToast } from "@/components/hooks/use-toast";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { checkMcpServerDynamicClientRegistration, createMcpServer, createStaticOAuthMcpServer, deleteMcpServer } from "@/ee/features/chat/mcp/actions";
import { ConnectMcpButton } from "@/ee/features/chat/mcp/components/connectMcpButton";
import { ConnectorCard } from "@/ee/features/chat/mcp/components/connectorCard";
import { useMcpToolMetadata } from "@/ee/features/chat/mcp/hooks/useMcpToolMetadata";
import { invalidateMcpConfigurationQueries, mcpQueryKeys } from "@/ee/features/chat/mcp/queryKeys";
import { pluralize } from "@/features/chat/mcp/utils";
import { cn, isServiceError } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, CableIcon, CopyIcon, Loader2, MoreHorizontalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { PrefabConnectorPopover } from "@/ee/features/chat/mcp/components/prefabConnectorPopover";
import Markdown from "react-markdown";
import { getStaticOAuthDescription, type PrefabMcpServer } from "@/ee/features/chat/mcp/prefabMcpServers";
import type { McpConfigurationServer, ServerToolsEntry } from "@/ee/features/chat/mcp/types";

function clearCallbackParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('status');
    url.searchParams.delete('server');
    url.searchParams.delete('message');
    window.history.replaceState({}, '', url.toString());
}

interface WorkspaceAskAgentPageProps {
    callbackStatus?: string;
    callbackServer?: string;
    callbackMessage?: string;
    oauthRedirectUrl: string;
}

type WorkspaceConnectorStatus = {
    isConnected: boolean;
    isAuthExpired: boolean;
};

interface WorkspaceConnectorCardProps {
    server: McpConfigurationServer;
    status?: WorkspaceConnectorStatus;
    isAskAgentAvailable: boolean;
    isStatusLoading: boolean;
    isStatusError: boolean;
    toolEntry?: ServerToolsEntry;
    isToolsLoading: boolean;
    isToolsError: boolean;
    onRetryTools: () => void;
    onCopyUrl: (serverUrl: string) => void;
    onDelete: (server: McpConfigurationServer) => void;
}

function WorkspaceConnectorCard({
    server,
    status,
    isAskAgentAvailable,
    isStatusLoading,
    isStatusError,
    toolEntry,
    isToolsLoading,
    isToolsError,
    onRetryTools,
    onCopyUrl,
    onDelete,
}: WorkspaceConnectorCardProps) {
    const isConnected = status?.isConnected === true;
    const isAuthExpired = status?.isAuthExpired === true;
    const isStatusUnavailable = isAskAgentAvailable !== true || isStatusLoading || isStatusError || !status;
    const showConnectButton = isAskAgentAvailable && !isStatusLoading && !isStatusError && !!status && !isConnected;
    const serverLabel = server.name || server.serverUrl;

    return (
        <ConnectorCard
            faviconUrl={server.faviconUrl}
            name={server.name}
            serverUrl={server.serverUrl}
            isConnected={isConnected}
            isAuthExpired={isAuthExpired}
            isAskAgentAvailable={isAskAgentAvailable}
            isStatusUnavailable={isStatusUnavailable}
            toolEntry={isConnected ? toolEntry : undefined}
            toolUsage={server.toolUsage}
            isToolsLoading={isToolsLoading}
            isToolsError={isToolsError}
            onRetryTools={onRetryTools}
            statusBadge={
                <span className={cn(
                    "inline-flex items-center gap-1.5",
                    server.savedConnectionCount > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
                )}>
                    <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        server.savedConnectionCount > 0 ? "bg-green-500/80" : "bg-muted-foreground",
                    )} />
                    {server.savedConnectionCount > 0
                        ? `${server.savedConnectionCount} ${pluralize(server.savedConnectionCount, "member")} connected`
                        : "No members connected"}
                </span>
            }
            actionButtons={
                <>
                    {showConnectButton && (
                        <ConnectMcpButton
                            serverId={server.id}
                            isConnected={isConnected}
                            isAuthExpired={isAuthExpired}
                            size="sm"
                            variant="outline"
                            className="h-8"
                            returnTo="/settings/workspaceAskAgent"
                        />
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Open actions for ${serverLabel}`}
                            >
                                <MoreHorizontalIcon className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onCopyUrl(server.serverUrl)}>
                                <CopyIcon className="h-4 w-4 mr-2" />
                                Copy URL
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDelete(server)}
                                aria-label={`Remove ${serverLabel}`}
                            >
                                <Trash2Icon className="h-4 w-4 mr-2" />
                                Remove
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </>
            }
        />
    );
}

export function WorkspaceAskAgentPage({ callbackStatus, callbackServer, callbackMessage, oauthRedirectUrl }: WorkspaceAskAgentPageProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const router = useRouter();
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
            toast({ title: "Connection failed", description: callbackMessage ?? 'Failed to connect connector.', variant: "destructive" });
            clearCallbackParams();
        }
    }, [callbackStatus, callbackServer, callbackMessage, toast]);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newServerName, setNewServerName] = useState("");
    const [newServerUrl, setNewServerUrl] = useState("");
    const [isClientCredentialsDialogOpen, setIsClientCredentialsDialogOpen] = useState(false);
    const [pendingClientCredentialsServer, setPendingClientCredentialsServer] = useState<{ name: string; serverUrl: string } | null>(null);
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
    const [serverToDelete, setServerToDelete] = useState<McpConfigurationServer | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: mcpQueryKeys.configuration,
        queryFn: async () => {
            const result = await getMcpConfiguration();
            if (isServiceError(result)) {
                throw new Error(result.message);
            }
            return result;
        },
    });

    const { data: serversWithStatus, isLoading: isServersWithStatusLoading, isError: isServersWithStatusError } = useQuery({
        queryKey: mcpQueryKeys.serversWithStatus,
        queryFn: async () => {
            const result = await getMcpServersWithStatus();
            if (isServiceError(result)) {
                throw new Error("Failed to load connector status");
            }
            if (!Array.isArray(result)) {
                throw new Error("Unexpected response from connector status endpoint");
            }
            return result;
        },
        enabled: data?.isAskAgentAvailable !== false,
    });

    const myStatusByServerId = useMemo(() => {
        const map = new Map<string, { isConnected: boolean; isAuthExpired: boolean }>();
        for (const s of serversWithStatus ?? []) {
            map.set(s.id, { isConnected: s.isConnected, isAuthExpired: s.isAuthExpired });
        }
        return map;
    }, [serversWithStatus]);

    const servers = data?.servers ?? [];
    const canCreateConnectors = data?.isAskAgentAvailable === true;
    const isAskAgentUnavailable = data?.isAskAgentAvailable === false;
    const connectedServerCount = useMemo(
        () => serversWithStatus?.filter((server) => server.isConnected).length ?? 0,
        [serversWithStatus],
    );
    const {
        isToolsLoading,
        isToolsError,
        refetchTools,
        toolsByServerId,
    } = useMcpToolMetadata(data?.isAskAgentAvailable === true, connectedServerCount);

    const handleCreateDialogOpenChange = (open: boolean) => {
        setIsCreateDialogOpen(open);

        if (!open) {
            setNewServerName("");
            setNewServerUrl("");
        }
    };

    const handleCloseCreateDialog = () => {
        handleCreateDialogOpenChange(false);
    };

    const handleCloseClientCredentialsDialog = () => {
        setIsClientCredentialsDialogOpen(false);
        setPendingClientCredentialsServer(null);
        setClientId("");
        setClientSecret("");
    };

    const handleOpenCustomUrlDialog = () => {
        setNewServerName("");
        setNewServerUrl("");
        setIsCreateDialogOpen(true);
    };

    const handleCreateStaticOAuthServer = async () => {
        if (!pendingClientCredentialsServer) {
            toast({ title: "Error", description: "Missing connector details", variant: "destructive" });
            return;
        }

        if (process.env.NODE_ENV === "production" && window.location.protocol !== "https:") {
            toast({
                title: "HTTPS required",
                description: "Static OAuth client credentials can only be submitted over HTTPS in production.",
                variant: "destructive",
            });
            return;
        }

        setIsCreating(true);
        try {
            const result = await createStaticOAuthMcpServer({
                name: pendingClientCredentialsServer.name,
                serverUrl: pendingClientCredentialsServer.serverUrl,
                clientId,
                clientSecret,
            });
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to add connector: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
            handleCloseClientCredentialsDialog();
        } catch {
            toast({ title: "Error", description: "Failed to add connector.", variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreateServer = async (
        name: string,
        serverUrl: string,
        onSuccess?: () => void,
        options: { checkDynamicClientRegistration?: boolean } = {},
    ) => {
        const displayName = name.trim();
        const normalizedServerUrl = serverUrl.trim();

        if (!displayName || !normalizedServerUrl) {
            toast({ title: "Error", description: "Name and connector URL are required", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            if (options.checkDynamicClientRegistration) {
                const dcrSupport = await checkMcpServerDynamicClientRegistration(normalizedServerUrl);
                if (isServiceError(dcrSupport)) {
                    toast({ title: "Error", description: `Failed to check connector: ${dcrSupport.message}`, variant: "destructive" });
                    return;
                }

                if (dcrSupport.isKnown && !dcrSupport.supportsDcr) {
                    setPendingClientCredentialsServer({ name: displayName, serverUrl: normalizedServerUrl });
                    setIsCreateDialogOpen(false);
                    setIsClientCredentialsDialogOpen(true);
                    return;
                }
            }

            const result = await createMcpServer(displayName, normalizedServerUrl);
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to add connector: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
            onSuccess?.();
        } catch (error) {
            toast({ title: "Error", description: `Failed to add connector: ${error}`, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreate = async () => {
        await handleCreateServer(newServerName, newServerUrl, handleCloseCreateDialog, {
            checkDynamicClientRegistration: true,
        });
    };

    const handleCreatePrefabServer = async (server: PrefabMcpServer) => {
        await handleCreateServer(server.name, server.serverUrl, undefined, {
            checkDynamicClientRegistration: true,
        });
    };

    const handleDelete = async (serverId: string) => {
        setDeletingServerId(serverId);
        try {
            const result = await deleteMcpServer(serverId);
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to remove connector: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
            setServerToDelete(null);

            // When the last connector is removed, re-run the server-side gate in
            // page.tsx, which swaps this page for the upsell if the deployment
            // lacks the `ask` entitlement. Only refresh in that case; otherwise
            // the query invalidation above already updates the list. (`servers`
            // is the pre-deletion list captured in this closure.)
            const isLastServer = servers.filter((s) => s.id !== serverId).length === 0;
            if (isLastServer) {
                router.refresh();
            }
        } catch (error) {
            toast({ title: "Error", description: `Failed to remove connector: ${error}`, variant: "destructive" });
        } finally {
            setDeletingServerId(null);
        }
    };

    const handleCopyUrl = (serverUrl: string) => {
        navigator.clipboard.writeText(serverUrl);
        toast({ title: "Copied", description: "Connector URL copied to clipboard." });
    };

    if (isError) {
        return <div>Error loading Ask Sourcebot settings</div>;
    }

    const prefabPopoverProps = {
        configuredServerUrls: servers.map((s) => s.serverUrl),
        disabled: isCreating,
        onSelectCustomUrl: handleOpenCustomUrlDialog,
        onSelectPrefabServer: handleCreatePrefabServer,
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Page header */}
            <div>
                <h3 className="text-lg font-medium">Ask Sourcebot</h3>
                <p className="text-sm text-muted-foreground">
                    Configure what external tools Ask Sourcebot can use across this workspace.
                </p>
            </div>

            <Separator />

            {/* Ask Sourcebot unavailable warning */}
            {!isLoading && isAskAgentUnavailable && (
                <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
                    <AlertTriangleIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                        <p className="text-sm font-medium">Ask Sourcebot connectors are unavailable</p>
                        <p className="text-sm text-muted-foreground">
                            You can remove existing approved connectors and stored credentials, but cannot add new connectors.
                        </p>
                    </div>
                </div>
            )}

            {/* Connectors section */}
            <div className="space-y-6">
                <div>
                    <h4 className="text-sm font-semibold text-foreground">Connectors</h4>
                    <p className="text-sm text-muted-foreground">
                        Connectors are MCP servers that let Ask Sourcebot use approved external tools alongside your indexed code.
                    </p>
                </div>

                {/* Allowed connectors subsection */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h4 className="text-sm font-semibold text-foreground">Allowed connectors</h4>
                            <p className="text-sm text-muted-foreground">
                                {isAskAgentUnavailable
                                    ? "Remove existing connector approvals and their stored credentials."
                                    : "Approve connector URLs that workspace members can connect to."}
                            </p>
                        </div>
                        {canCreateConnectors && (
                            <PrefabConnectorPopover {...prefabPopoverProps}>
                                <Button variant="outline" size="sm" disabled={isCreating}>
                                    <PlusIcon className="h-4 w-4 mr-1.5" />
                                    Add connector
                                </Button>
                            </PrefabConnectorPopover>
                        )}
                    </div>

                    {/* Connector list */}
                    <div className="space-y-2">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <Card key={i}>
                                    <CardContent className="flex items-center gap-3 p-3">
                                        <Skeleton className="h-8 w-8 rounded-lg" />
                                        <div className="flex-1 space-y-1.5">
                                            <Skeleton className="h-4 w-36" />
                                            <Skeleton className="h-3 w-56" />
                                        </div>
                                        <Skeleton className="h-8 w-20" />
                                    </CardContent>
                                </Card>
                            ))
                        ) : servers.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="rounded-full bg-muted p-3 mb-4">
                                        <CableIcon className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm font-medium mb-1">No connectors configured yet</p>
                                    <p className="text-sm text-muted-foreground max-w-sm">
                                        {isAskAgentUnavailable
                                            ? "Ask Sourcebot connectors are unavailable on this Sourcebot instance."
                                            : "Add a workspace-approved connector so members can use it with Ask Sourcebot."}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            servers.map((server) => (
                                <WorkspaceConnectorCard
                                    key={server.id}
                                    server={server}
                                    status={myStatusByServerId.get(server.id)}
                                    isAskAgentAvailable={data?.isAskAgentAvailable === true}
                                    isStatusLoading={isServersWithStatusLoading}
                                    isStatusError={isServersWithStatusError}
                                    toolEntry={toolsByServerId.get(server.id)}
                                    isToolsLoading={isToolsLoading}
                                    isToolsError={isToolsError}
                                    onRetryTools={() => { void refetchTools(); }}
                                    onCopyUrl={handleCopyUrl}
                                    onDelete={setServerToDelete}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Delete confirmation */}
            <AlertDialog open={!!serverToDelete} onOpenChange={(open) => { if (!open) { setServerToDelete(null); } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Connector</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove <span className="font-semibold text-foreground">{serverToDelete?.name || serverToDelete?.serverUrl}</span>? Workspace members will lose access and stored credentials for this connector.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { if (serverToDelete) { handleDelete(serverToDelete.id); } }}
                            disabled={deletingServerId !== null}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deletingServerId ? "Removing..." : "Remove"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Add connector dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Connector</DialogTitle>
                        <DialogDescription>
                            Add a workspace-approved connector that members can use with Ask Sourcebot.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="mcp-configuration-name">Name</Label>
                            <Input
                                id="mcp-configuration-name"
                                value={newServerName}
                                onChange={(event) => setNewServerName(event.target.value)}
                                placeholder="e.g. Linear"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mcp-configuration-url">Connector URL</Label>
                            <Input
                                id="mcp-configuration-url"
                                value={newServerUrl}
                                onChange={(event) => setNewServerUrl(event.target.value)}
                                placeholder="https://mcp.linear.app/mcp"
                            />
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-between">
                        <Button variant="outline" onClick={handleCloseCreateDialog}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={isCreating || !newServerName.trim() || !newServerUrl.trim()}>
                            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {isCreating ? "Checking..." : "Add"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* OAuth client credentials dialog */}
            <Dialog open={isClientCredentialsDialogOpen} onOpenChange={(open) => {
                if (!open) {
                    handleCloseClientCredentialsDialog();
                    return;
                }

                setIsClientCredentialsDialogOpen(true);
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>OAuth Client Credentials Required</DialogTitle>
                        <DialogDescription asChild>
                            <div className="text-sm text-muted-foreground">
                                <Markdown
                                    components={{
                                        p: ({ children }) => <p className="[&:not(:first-child)]:mt-2">{children}</p>,
                                        a: ({ children, href }) => (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-link hover:underline"
                                            >
                                                {children}
                                            </a>
                                        ),
                                        code: ({ children }) => (
                                            <span className="inline-flex items-center gap-1 align-middle">
                                                <code className="bg-muted rounded px-1 py-0.5 text-xs break-all">{children}</code>
                                                <button
                                                    type="button"
                                                    aria-label="Copy redirect URL"
                                                    className="text-muted-foreground hover:text-foreground"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(String(children));
                                                        toast({ title: "Copied", description: "Redirect URL copied to clipboard." });
                                                    }}
                                                >
                                                    <CopyIcon className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ),
                                    }}
                                >
                                    {getStaticOAuthDescription(pendingClientCredentialsServer?.serverUrl ?? "", oauthRedirectUrl)}
                                </Markdown>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {pendingClientCredentialsServer && (
                            <div className="rounded-md border bg-muted/40 p-3">
                                <p className="text-sm font-medium truncate">{pendingClientCredentialsServer.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{pendingClientCredentialsServer.serverUrl}</p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="mcp-configuration-client-id">Client ID</Label>
                            <Input
                                id="mcp-configuration-client-id"
                                value={clientId}
                                autoComplete="off"
                                onChange={(event) => setClientId(event.target.value)}
                                placeholder="OAuth client ID"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mcp-configuration-client-secret">Client Secret</Label>
                            <Input
                                id="mcp-configuration-client-secret"
                                type="password"
                                value={clientSecret}
                                autoComplete="new-password"
                                onChange={(event) => setClientSecret(event.target.value)}
                                placeholder="OAuth client secret"
                            />
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-between">
                        <Button variant="outline" onClick={handleCloseClientCredentialsDialog}>Cancel</Button>
                        <Button
                            onClick={handleCreateStaticOAuthServer}
                            disabled={isCreating || !clientId.trim() || !clientSecret.trim()}
                        >
                            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
