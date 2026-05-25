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
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { createMcpServer, deleteMcpServer } from "@/ee/features/mcp/actions";
import { McpFavicon } from "@/ee/features/mcp/components/mcpFavicon";
import { invalidateMcpConfigurationQueries, mcpQueryKeys } from "@/ee/features/mcp/queryKeys";
import { isServiceError } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MinusIcon, PlusIcon, ServerIcon } from "lucide-react";

function pluralize(count: number, singular: string, plural = `${singular}s`) {
    return count === 1 ? singular : plural;
}

export function McpConfigurationPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newServerName, setNewServerName] = useState("");
    const [newServerUrl, setNewServerUrl] = useState("");
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

    const handleCloseCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setNewServerName("");
        setNewServerUrl("");
    };

    const handleCreate = async () => {
        if (!newServerName.trim() || !newServerUrl.trim()) {
            toast({ title: "Error", description: "Name and server URL are required", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const result = await createMcpServer(newServerName.trim(), newServerUrl.trim());
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to add MCP server: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
            handleCloseCreateDialog();
        } catch (error) {
            toast({ title: "Error", description: `Failed to add MCP server: ${error}`, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
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
                                Sourcebot Ask can use only workspace-approved MCP servers.
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
                        <CardDescription>Approve server URLs that workspace members can connect to.</CardDescription>
                    </div>
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Add MCP server">
                                <PlusIcon className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add MCP Server</DialogTitle>
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
                                    Add
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
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
                                Add a workspace-approved MCP server so members can connect it to Ask Sourcebot.
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
