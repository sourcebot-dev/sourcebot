'use client';

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/hooks/use-toast";
import { isServiceError } from "@/lib/utils";
import { createMcpServer, deleteMcpServer } from "@/ee/features/mcp/actions";
import { getMcpServersWithStatus } from "@/app/api/(client)/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConnectMcpButton } from "@/ee/features/mcp/components/connectMcpButton";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { McpFavicon } from "@/ee/features/mcp/components/mcpFavicon";
import { Loader2, Plus, Server, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
}

export function McpServersPage({ callbackStatus, callbackServer, callbackMessage }: McpServersPageProps) {
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

    const queryClient = useQueryClient();

    const { data: servers = [], isLoading, isError } = useQuery({
        queryKey: ['mcpServersWithStatus'],
        queryFn: async () => {
            const result = await getMcpServersWithStatus();
            if (isServiceError(result)) {
                throw new Error("Failed to load MCP servers");
            }
            return result;
        },
    });

    // Create dialog state
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newServerName, setNewServerName] = useState("");
    const [newServerUrl, setNewServerUrl] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Delete state
    const [deletingServerId, setDeletingServerId] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!newServerUrl.trim()) {
            toast({ title: "Error", description: "Server URL is required", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const result = await createMcpServer(newServerName.trim(), newServerUrl.trim());
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to add MCP server: ${result.message}`, variant: "destructive" });
                return;
            }
            await queryClient.invalidateQueries({ queryKey: ['mcpServersWithStatus'] });
            handleCloseCreateDialog();
        } catch (e) {
            toast({ title: "Error", description: `Failed to add MCP server: ${e}`, variant: "destructive" });
        } finally {
            setIsCreating(false);
        }
    };

    const handleCloseCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setNewServerName("");
        setNewServerUrl("");
    };

    const handleDelete = async (serverId: string) => {
        setDeletingServerId(serverId);
        try {
            const result = await deleteMcpServer(serverId);
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to delete: ${result.message}`, variant: "destructive" });
                return;
            }
            await queryClient.invalidateQueries({ queryKey: ['mcpServersWithStatus'] });
        } catch (e) {
            toast({ title: "Error", description: `Failed to delete MCP server: ${e}`, variant: "destructive" });
        } finally {
            setDeletingServerId(null);
        }
    };

    if (isError) {
        return <div>Error loading MCP servers</div>;
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header + Add button */}
            <div className="flex flex-row items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">MCP Servers</h3>
                    <p className="text-sm text-muted-foreground max-w-lg">
                        Connect external MCP servers to use with Ask Sourcebot.
                    </p>
                </div>

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setIsCreateDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add MCP Server
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add MCP Server</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="mcp-name">Name</Label>
                                <Input
                                    id="mcp-name"
                                    value={newServerName}
                                    onChange={(e) => setNewServerName(e.target.value)}
                                    placeholder="e.g. Linear"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mcp-url">Server URL</Label>
                                <Input
                                    id="mcp-url"
                                    value={newServerUrl}
                                    onChange={(e) => setNewServerUrl(e.target.value)}
                                    placeholder="https://mcp.linear.app/mcp"
                                />
                            </div>
                        </div>
                        <DialogFooter className="sm:justify-between">
                            <Button variant="outline" onClick={handleCloseCreateDialog}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={isCreating || !newServerUrl.trim()}>
                                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Add
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Server list */}
            {isLoading ? (
                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <Card key={i}>
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
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-muted p-3 mb-4">
                            <Server className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">No MCP servers yet</p>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Click &quot;Add MCP Server&quot; above to connect an external MCP server.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {servers.map((server) => (
                        <Card key={server.id}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <McpFavicon faviconUrl={server.faviconUrl} className="w-5 h-5" />
                                        <div>
                                            <CardTitle>{server.name || server.serverUrl}</CardTitle>
                                            <CardDescription>{server.serverUrl}</CardDescription>
                                        </div>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete MCP Server</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to remove <span className="font-semibold text-foreground">{server.name || server.serverUrl}</span>? This will remove the server and your credentials from your list.
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