'use client';

import { useState } from "react";
import { getMcpConfiguration } from "@/app/api/(client)/client";
import { useToast } from "@/components/hooks/use-toast";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { checkMcpServerDynamicClientRegistration, createMcpServer, createStaticOAuthMcpServer, deleteMcpServer } from "@/ee/features/mcp/actions";
import { McpFavicon } from "@/ee/features/mcp/components/mcpFavicon";
import { invalidateMcpConfigurationQueries, mcpQueryKeys } from "@/ee/features/mcp/queryKeys";
import { isServiceError } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, Loader2, MinusIcon, PlusIcon, ServerIcon } from "lucide-react";
import { PrefabMcpServerPopover } from "./prefabMcpServerPopover";
import type { PrefabMcpServer } from "@/ee/features/mcp/prefabMcpServers";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
    return count === 1 ? singular : plural;
}

export function McpConfigurationPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newServerName, setNewServerName] = useState("");
    const [newServerUrl, setNewServerUrl] = useState("");
    const [isClientCredentialsDialogOpen, setIsClientCredentialsDialogOpen] = useState(false);
    const [pendingClientCredentialsServer, setPendingClientCredentialsServer] = useState<{ name: string; serverUrl: string } | null>(null);
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [deletingServerId, setDeletingServerId] = useState<string | null>(null);

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

    const servers = data?.servers ?? [];
    const totalSavedConnectionCount = data?.totalSavedConnectionCount ?? 0;
    const canCreateMcpServers = data?.isOAuthAvailable === true;
    const isOAuthUnavailable = data?.isOAuthAvailable === false;

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
            toast({ title: "Error", description: "Missing MCP server details", variant: "destructive" });
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
                toast({ title: "Error", description: `Failed to add MCP server: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
            handleCloseClientCredentialsDialog();
        } catch {
            toast({ title: "Error", description: "Failed to add MCP server.", variant: "destructive" });
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
            toast({ title: "Error", description: "Name and server URL are required", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            if (options.checkDynamicClientRegistration) {
                const dcrSupport = await checkMcpServerDynamicClientRegistration(normalizedServerUrl);
                if (isServiceError(dcrSupport)) {
                    toast({ title: "Error", description: `Failed to check MCP server: ${dcrSupport.message}`, variant: "destructive" });
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
                toast({ title: "Error", description: `Failed to add MCP server: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
            onSuccess?.();
        } catch (error) {
            toast({ title: "Error", description: `Failed to add MCP server: ${error}`, variant: "destructive" });
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
                toast({ title: "Error", description: `Failed to delete MCP server: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
        } catch (error) {
            toast({ title: "Error", description: `Failed to delete MCP server: ${error}`, variant: "destructive" });
        } finally {
            setDeletingServerId(null);
        }
    };

    if (isError) {
        return <div>Error loading MCP configuration</div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">MCP Configuration</h3>
                <p className="text-sm text-muted-foreground max-w-lg">
                    Configure the MCP servers that workspace members can connect to.
                </p>
            </div>

            {!isLoading && isOAuthUnavailable && (
                <Card className="bg-muted/40">
                    <CardContent className="flex items-start gap-3 p-4">
                        <AlertTriangleIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                            <p className="text-sm font-medium">OAuth MCP is unavailable</p>
                            <p className="text-sm text-muted-foreground">
                                You can remove existing approved servers and stored credentials, but cannot add new MCP servers.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0 divide-y">
                    <div className="flex items-center justify-between gap-4 p-5">
                        <div>
                            <p className="font-medium">Saved MCP connections</p>
                            <p className="text-sm text-muted-foreground">
                                Current workspace members with saved MCP server credentials.
                            </p>
                        </div>
                        {isLoading ? (
                            <Skeleton className="h-6 w-28" />
                        ) : (
                            <p className="text-sm text-muted-foreground whitespace-nowrap">
                                {totalSavedConnectionCount} {pluralize(totalSavedConnectionCount, "connection")}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-4 p-5">
                        <div>
                            <p className="font-medium">Allowed MCP servers</p>
                            <p className="text-sm text-muted-foreground">
                                {isOAuthUnavailable
                                    ? "Existing workspace-approved MCP servers are available for cleanup."
                                    : "Sourcebot Ask can use only workspace-approved MCP servers."}
                            </p>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-nowrap">Only approved servers</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle>{isLoading ? "Allowed servers" : `${servers.length} allowed ${pluralize(servers.length, "server")}`}</CardTitle>
                        <CardDescription>
                            {isOAuthUnavailable
                                ? "Remove existing server approvals and their stored credentials."
                                : "Approve server URLs that workspace members can connect to."}
                        </CardDescription>
                    </div>
                    {canCreateMcpServers ? (
                        <>
                            <PrefabMcpServerPopover
                                configuredServerUrls={servers.map((server) => server.serverUrl)}
                                disabled={isCreating}
                                onSelectCustomUrl={handleOpenCustomUrlDialog}
                                onSelectPrefabServer={handleCreatePrefabServer}
                            />
                            <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Add MCP Server</DialogTitle>
                                        <DialogDescription>
                                            Add a workspace-approved MCP server that members can connect to from Ask Sourcebot.
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
                                            <Label htmlFor="mcp-configuration-url">Server URL</Label>
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
                                        <DialogDescription>
                                            This MCP server does not advertise dynamic client registration. Provide OAuth client credentials from a pre-registered app before members can connect to it.
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
                        </>
                    ) : (
                        <Button size="icon" variant="ghost" disabled aria-label="Add MCP server unavailable">
                            <PlusIcon className="h-4 w-4" />
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="flex items-center gap-4 border-b pb-4 last:border-b-0 last:pb-0">
                                    <Skeleton className="h-10 w-10 rounded-md" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-48" />
                                        <Skeleton className="h-3 w-72" />
                                    </div>
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            ))}
                        </div>
                    ) : servers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="rounded-full bg-muted p-3 mb-4">
                                <ServerIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-foreground mb-1">No MCP servers configured yet</p>
                            <p className="text-sm text-muted-foreground max-w-sm">
                                {isOAuthUnavailable
                                    ? "OAuth MCP is unavailable on this Sourcebot instance."
                                    : "Add a workspace-approved MCP server so members can connect it to Ask Sourcebot."}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {servers.map((server) => (
                                <div key={server.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                                        <McpFavicon faviconUrl={server.faviconUrl} className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium truncate">{server.name || server.serverUrl}</p>
                                        <p className="text-sm text-muted-foreground truncate">{server.serverUrl}</p>
                                    </div>
                                    <p className="hidden text-sm text-muted-foreground whitespace-nowrap sm:block">
                                        {server.savedConnectionCount} {pluralize(server.savedConnectionCount, "saved connection")}
                                    </p>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive"
                                                aria-label={`Delete ${server.name || server.serverUrl}`}
                                            >
                                                <MinusIcon className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete MCP Server</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to remove <span className="font-semibold text-foreground">{server.name || server.serverUrl}</span>? Workspace members will lose access and stored credentials for this server.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleDelete(server.id)}
                                                    disabled={deletingServerId === server.id}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    {deletingServerId === server.id ? "Deleting..." : "Delete"}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
