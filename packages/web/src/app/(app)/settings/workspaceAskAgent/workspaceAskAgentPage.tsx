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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { checkMcpServerDynamicClientRegistration, createMcpServer, createStaticOAuthMcpServer, deleteMcpServer, updateMcpServerScopes } from "@/ee/features/chat/mcp/actions";
import { ConnectMcpButton } from "@/ee/features/chat/mcp/components/connectMcpButton";
import { ConnectorCard } from "@/ee/features/chat/mcp/components/connectorCard";
import { useMcpToolMetadata } from "@/ee/features/chat/mcp/hooks/useMcpToolMetadata";
import { invalidateMcpConfigurationQueries, mcpQueryKeys } from "@/ee/features/chat/mcp/queryKeys";
import { buildMcpScopeEntries, getMcpRequestedScopes, normalizeMcpRequestedScopes } from "@/ee/features/chat/mcp/scopeUtils";
import { pluralize } from "@/features/chat/mcp/utils";
import { cn, isServiceError } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, CableIcon, CopyIcon, KeyRoundIcon, Loader2, MoreHorizontalIcon, PlusIcon, Trash2Icon, WrenchIcon } from "lucide-react";
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

function scopesEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((scope, index) => scope === b[index]);
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

type PendingConnectorServer = {
    name: string;
    serverUrl: string;
    discoveredScopes: string[];
};

interface OAuthScopesInputProps {
    discoveredScopes: string[];
    selectedScopes: string[];
    customScopeInput: string;
    customScopesInputId: string;
    onSelectedScopesChange: (scopes: string[]) => void;
    onCustomScopeInputChange: (value: string) => void;
    onRemoveScope?: (scope: string) => void;
}

function OAuthScopesInput({
    discoveredScopes,
    selectedScopes,
    customScopeInput,
    customScopesInputId,
    onSelectedScopesChange,
    onCustomScopeInputChange,
    onRemoveScope,
}: OAuthScopesInputProps) {
    const [scopeSearchInput, setScopeSearchInput] = useState("");
    const selectedScopeSet = new Set(selectedScopes);
    const requestedScopes = getMcpRequestedScopes(selectedScopes, customScopeInput);
    const filteredScopes = useMemo(() => {
        const query = scopeSearchInput.trim().toLowerCase();
        if (!query) {
            return discoveredScopes;
        }

        return discoveredScopes.filter((scope) => scope.toLowerCase().includes(query));
    }, [discoveredScopes, scopeSearchInput]);

    const handleCheckedChange = (scope: string, checked: boolean) => {
        onSelectedScopesChange(checked
            ? normalizeMcpRequestedScopes([...selectedScopes, scope])
            : selectedScopes.filter((selectedScope) => selectedScope !== scope));
    };

    const handleSelectAll = () => {
        onSelectedScopesChange(normalizeMcpRequestedScopes([...selectedScopes, ...filteredScopes]));
    };

    const handleClear = () => {
        onSelectedScopesChange([]);
        onCustomScopeInputChange("");
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <Label>OAuth scopes</Label>
                    <p className="text-xs text-muted-foreground">{requestedScopes.length} requested</p>
                </div>
                <div className="flex items-center gap-1">
                    {discoveredScopes.length > 0 && (
                        <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll} disabled={filteredScopes.length === 0}>
                            {scopeSearchInput.trim() ? "Select shown" : "Select all"}
                        </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={requestedScopes.length === 0}>
                        Clear
                    </Button>
                </div>
            </div>

            {discoveredScopes.length > 0 && (
                <div className="space-y-2">
                    <Input
                        value={scopeSearchInput}
                        onChange={(event) => setScopeSearchInput(event.target.value)}
                        placeholder="Search scopes"
                        className="h-9"
                    />
                    <div className="max-h-56 overflow-y-auto rounded-md border">
                        {filteredScopes.length > 0 ? (
                            filteredScopes.map((scope) => (
                                <div
                                    key={scope}
                                    className="flex min-h-9 items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
                                >
                                    <label className="flex flex-1 cursor-pointer items-center gap-2">
                                        <Checkbox
                                            checked={selectedScopeSet.has(scope)}
                                            onCheckedChange={(checked) => handleCheckedChange(scope, checked === true)}
                                            aria-label={`Request ${scope}`}
                                        />
                                        <span className="break-all font-mono text-xs">{scope}</span>
                                    </label>
                                    {onRemoveScope && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => onRemoveScope(scope)}
                                            aria-label={`Remove ${scope}`}
                                        >
                                            <Trash2Icon className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                No matching scopes
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor={customScopesInputId}>Custom scopes</Label>
                <Textarea
                    id={customScopesInputId}
                    value={customScopeInput}
                    onChange={(event) => onCustomScopeInputChange(event.target.value)}
                    placeholder="e.g. repo, channels:read"
                    className="min-h-20 resize-y font-mono text-sm"
                />
            </div>
        </div>
    );
}

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
    onEditScopes: (server: McpConfigurationServer) => void;
    onEditToolPermissions: (server: McpConfigurationServer) => void;
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
    onEditScopes,
    onEditToolPermissions,
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
                    <DropdownMenu modal={false}>
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
                            {isAskAgentAvailable && (
                                <>
                                    <DropdownMenuItem onClick={() => onEditScopes(server)}>
                                        <KeyRoundIcon className="h-4 w-4 mr-2" />
                                        Edit OAuth scopes
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onEditToolPermissions(server)}>
                                        <WrenchIcon className="h-4 w-4 mr-2" />
                                        Edit tool permissions
                                    </DropdownMenuItem>
                                </>
                            )}
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
    const [pendingClientCredentialsServer, setPendingClientCredentialsServer] = useState<PendingConnectorServer | null>(null);
    const [isScopeSelectionDialogOpen, setIsScopeSelectionDialogOpen] = useState(false);
    const [pendingScopeSelectionServer, setPendingScopeSelectionServer] = useState<PendingConnectorServer | null>(null);
    const [knownScopes, setKnownScopes] = useState<string[]>([]);
    const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
    const [customScopeInput, setCustomScopeInput] = useState("");
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdatingScopes, setIsUpdatingScopes] = useState(false);
    const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
    const [serverToDelete, setServerToDelete] = useState<McpConfigurationServer | null>(null);
    const [serverToEditScopes, setServerToEditScopes] = useState<McpConfigurationServer | null>(null);

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
    const editedScopeEntries = useMemo(() => buildMcpScopeEntries({
        availableScopes: knownScopes,
        requestedScopes: getMcpRequestedScopes(selectedScopes, customScopeInput),
    }), [knownScopes, selectedScopes, customScopeInput]);
    const currentEditedServerRequestedScopes = useMemo(() => (
        normalizeMcpRequestedScopes(
            serverToEditScopes?.scopes
                .filter((entry) => entry.enabled)
                .map((entry) => entry.scope) ?? [],
        )
    ), [serverToEditScopes]);
    const editedRequestedScopes = useMemo(() => (
        normalizeMcpRequestedScopes(
            editedScopeEntries
                .filter((entry) => entry.enabled)
                .map((entry) => entry.scope),
        )
    ), [editedScopeEntries]);
    const scopeUpdateReauthConnectionCount = serverToEditScopes?.savedConnectionCount ?? 0;
    const scopeUpdateRequiresReauth = !!serverToEditScopes &&
        scopeUpdateReauthConnectionCount > 0 &&
        !scopesEqual(currentEditedServerRequestedScopes, editedRequestedScopes);

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

    const resetScopeInputs = () => {
        setSelectedScopes([]);
        setCustomScopeInput("");
    };

    const handleCloseClientCredentialsDialog = () => {
        setIsClientCredentialsDialogOpen(false);
        setPendingClientCredentialsServer(null);
        setClientId("");
        setClientSecret("");
        resetScopeInputs();
    };

    const handleCloseScopeSelectionDialog = () => {
        setIsScopeSelectionDialogOpen(false);
        setPendingScopeSelectionServer(null);
        resetScopeInputs();
    };

    const handleOpenEditScopesDialog = (server: McpConfigurationServer) => {
        setServerToEditScopes(server);
        setKnownScopes(normalizeMcpRequestedScopes(server.scopes.map((entry) => entry.scope)));
        setSelectedScopes(normalizeMcpRequestedScopes(
            server.scopes.filter((entry) => entry.enabled).map((entry) => entry.scope),
        ));
        setCustomScopeInput("");
    };

    const handleCloseEditScopesDialog = () => {
        setServerToEditScopes(null);
        setKnownScopes([]);
        resetScopeInputs();
    };

    const handleRemoveKnownScope = (scope: string) => {
        setKnownScopes((currentScopes) => currentScopes.filter((currentScope) => currentScope !== scope));
        setSelectedScopes((currentScopes) => currentScopes.filter((currentScope) => currentScope !== scope));
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
                requestedScopes: getMcpRequestedScopes(selectedScopes, customScopeInput),
                availableScopes: pendingClientCredentialsServer.discoveredScopes,
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

    const handleCreateDynamicOAuthServer = async () => {
        if (!pendingScopeSelectionServer) {
            toast({ title: "Error", description: "Missing connector details", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const result = await createMcpServer(
                pendingScopeSelectionServer.name,
                pendingScopeSelectionServer.serverUrl,
                getMcpRequestedScopes(selectedScopes, customScopeInput),
                pendingScopeSelectionServer.discoveredScopes,
            );
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to add connector: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
            handleCloseScopeSelectionDialog();
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

                const discoveredScopes = normalizeMcpRequestedScopes(dcrSupport.scopesSupported);
                if (dcrSupport.isKnown && !dcrSupport.supportsDcr) {
                    resetScopeInputs();
                    setPendingClientCredentialsServer({
                        name: displayName,
                        serverUrl: normalizedServerUrl,
                        discoveredScopes,
                    });
                    setIsCreateDialogOpen(false);
                    setIsClientCredentialsDialogOpen(true);
                    return;
                }

                if (discoveredScopes.length > 0) {
                    resetScopeInputs();
                    setPendingScopeSelectionServer({
                        name: displayName,
                        serverUrl: normalizedServerUrl,
                        discoveredScopes,
                    });
                    setIsCreateDialogOpen(false);
                    setIsScopeSelectionDialogOpen(true);
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

    const handleUpdateScopes = async () => {
        if (!serverToEditScopes) {
            toast({ title: "Error", description: "Missing connector details", variant: "destructive" });
            return;
        }

        setIsUpdatingScopes(true);
        try {
            const result = await updateMcpServerScopes(
                serverToEditScopes.id,
                editedScopeEntries,
            );
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to update scopes: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
            handleCloseEditScopesDialog();
            toast({
                description: result.invalidatedConnectionCount > 0
                    ? `OAuth scopes updated. ${result.invalidatedConnectionCount} saved ${pluralize(result.invalidatedConnectionCount, "connection")} will need to reconnect.`
                    : "OAuth scopes updated.",
            });
        } catch {
            toast({ title: "Error", description: "Failed to update scopes.", variant: "destructive" });
        } finally {
            setIsUpdatingScopes(false);
        }
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
                                <Button variant="outline" size="sm">
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
                                    onEditScopes={handleOpenEditScopesDialog}
                                    onEditToolPermissions={(server) => router.push(`/settings/workspaceAskAgent/connectors/${server.id}/tools`)}
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

            {/* OAuth scope selection dialog */}
            <Dialog open={isScopeSelectionDialogOpen} onOpenChange={(open) => {
                if (!open) {
                    handleCloseScopeSelectionDialog();
                    return;
                }

                setIsScopeSelectionDialogOpen(true);
            }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>OAuth Scopes</DialogTitle>
                        <DialogDescription>
                            Choose the OAuth scopes Sourcebot should request for this connector.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {pendingScopeSelectionServer && (
                            <div className="rounded-md border bg-muted/40 p-3">
                                <p className="text-sm font-medium truncate">{pendingScopeSelectionServer.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{pendingScopeSelectionServer.serverUrl}</p>
                            </div>
                        )}
                        <OAuthScopesInput
                            discoveredScopes={pendingScopeSelectionServer?.discoveredScopes ?? []}
                            selectedScopes={selectedScopes}
                            customScopeInput={customScopeInput}
                            customScopesInputId="mcp-configuration-dynamic-oauth-scopes"
                            onSelectedScopesChange={setSelectedScopes}
                            onCustomScopeInputChange={setCustomScopeInput}
                        />
                    </div>
                    <DialogFooter className="sm:justify-between">
                        <Button variant="outline" onClick={handleCloseScopeSelectionDialog}>Cancel</Button>
                        <Button onClick={handleCreateDynamicOAuthServer} disabled={isCreating}>
                            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit OAuth scopes dialog */}
            <Dialog open={!!serverToEditScopes} onOpenChange={(open) => {
                if (!open) {
                    handleCloseEditScopesDialog();
                    return;
                }
            }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit OAuth Scopes</DialogTitle>
                        <DialogDescription>
                            Changing scopes clears saved member authorizations so users can reconnect with the updated scopes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {serverToEditScopes && (
                            <div className="rounded-md border bg-muted/40 p-3">
                                <p className="text-sm font-medium truncate">{serverToEditScopes.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{serverToEditScopes.serverUrl}</p>
                            </div>
                        )}
                        <OAuthScopesInput
                            discoveredScopes={knownScopes}
                            selectedScopes={selectedScopes}
                            customScopeInput={customScopeInput}
                            customScopesInputId="mcp-configuration-edit-oauth-scopes"
                            onSelectedScopesChange={setSelectedScopes}
                            onCustomScopeInputChange={setCustomScopeInput}
                            onRemoveScope={handleRemoveKnownScope}
                        />
                        {scopeUpdateRequiresReauth && (
                            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                <p>
                                    Applying this change will require <span className="font-medium text-destructive">{scopeUpdateReauthConnectionCount} saved {pluralize(scopeUpdateReauthConnectionCount, "connection")}</span> to reconnect.
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="sm:justify-between">
                        <Button variant="outline" onClick={handleCloseEditScopesDialog}>Cancel</Button>
                        <Button onClick={handleUpdateScopes} disabled={isUpdatingScopes}>
                            {isUpdatingScopes && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Apply
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
                <DialogContent className="sm:max-w-lg">
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
                        <OAuthScopesInput
                            discoveredScopes={pendingClientCredentialsServer?.discoveredScopes ?? []}
                            selectedScopes={selectedScopes}
                            customScopeInput={customScopeInput}
                            customScopesInputId="mcp-configuration-static-oauth-scopes"
                            onSelectedScopesChange={setSelectedScopes}
                            onCustomScopeInputChange={setCustomScopeInput}
                        />
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
