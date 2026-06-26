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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { checkMcpServerDynamicClientRegistration, createMcpServer, createStaticOAuthMcpServer, deleteMcpServer, updateMcpServerOAuthScopes } from "@/ee/features/chat/mcp/actions";
import { ConnectMcpButton } from "@/ee/features/chat/mcp/components/connectMcpButton";
import { ConnectorCard } from "@/ee/features/chat/mcp/components/connectorCard";
import { useMcpToolMetadata } from "@/ee/features/chat/mcp/hooks/useMcpToolMetadata";
import { invalidateMcpConfigurationQueries, mcpQueryKeys } from "@/ee/features/chat/mcp/queryKeys";
import { buildMcpOAuthScopeEntries, getMcpRequestedOAuthScopes, normalizeMcpRequestedOAuthScopes, OFFLINE_ACCESS_SCOPE } from "@/ee/features/chat/mcp/oauthScopeUtils";
import { pluralize } from "@/features/chat/mcp/utils";
import { cn, isServiceError } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, Building2Icon, CableIcon, CopyIcon, InfoIcon, KeyRoundIcon, Loader2, MoreHorizontalIcon, PlusIcon, Trash2Icon, WrenchIcon } from "lucide-react";
import { PrefabConnectorPopover } from "@/ee/features/chat/mcp/components/prefabConnectorPopover";
import Markdown from "react-markdown";
import { getStaticOAuthDescription, type PrefabMcpServer } from "@/ee/features/chat/mcp/prefabMcpServers";
import {
    deleteWorkspaceSkill,
    updateWorkspaceSkillFlag,
    type OrgSkillFlagKey,
} from "@/ee/features/chat/skills/components/workspaceSkillMutations";
import {
    AutoEnrolledSkillBadge,
    DeleteWorkspaceSkillDialog,
    FeaturedSkillBadge,
    OrgSkillFlagToggle,
    SkillCommandBadge,
    WorkspaceSkillsEmptyState,
} from "@/ee/features/chat/skills/components/workspaceSkillShared";
import { sortSharedAgentSkillCatalogItems, type SharedAgentSkillManagementItem } from "@/ee/features/chat/skills/types";
import type { McpConfigurationServer, ServerToolsEntry } from "@/ee/features/chat/mcp/types";

function clearCallbackParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('status');
    url.searchParams.delete('server');
    url.searchParams.delete('message');
    window.history.replaceState({}, '', url.toString());
}

function oauthScopesEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((scope, index) => scope === b[index]);
}

interface WorkspaceAskAgentPageProps {
    callbackStatus?: string;
    callbackServer?: string;
    callbackMessage?: string;
    oauthRedirectUrl: string;
    initialOrgSkills: SharedAgentSkillManagementItem[];
}

type WorkspaceConnectorStatus = {
    isConnected: boolean;
    isAuthExpired: boolean;
};

type PendingConnectorServer = {
    name: string;
    serverUrl: string;
    discoveredOAuthScopes: string[];
};

const scrollableConnectorDialogContentClassName = "flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden";
const scrollableConnectorDialogBodyClassName = "min-h-0 overflow-y-auto py-4 pr-1";

interface OAuthScopesInputProps {
    discoveredOAuthScopes: string[];
    selectedOAuthScopes: string[];
    customOAuthScopeInput: string;
    customOAuthScopesInputId: string;
    onSelectedOAuthScopesChange: (oauthScopes: string[]) => void;
    onCustomOAuthScopeInputChange: (value: string) => void;
    onRemoveOAuthScope?: (scope: string) => void;
}

function OAuthScopesInput({
    discoveredOAuthScopes,
    selectedOAuthScopes,
    customOAuthScopeInput,
    customOAuthScopesInputId,
    onSelectedOAuthScopesChange,
    onCustomOAuthScopeInputChange,
    onRemoveOAuthScope,
}: OAuthScopesInputProps) {
    const [oauthScopeSearchInput, setOAuthScopeSearchInput] = useState("");
    const selectedOAuthScopeSet = new Set(selectedOAuthScopes);
    const requestedOAuthScopes = getMcpRequestedOAuthScopes(selectedOAuthScopes, customOAuthScopeInput);
    const hasDiscoveredResourceScopes = discoveredOAuthScopes.some((scope) => scope !== OFFLINE_ACCESS_SCOPE);
    const isOfflineAccessOnly = requestedOAuthScopes.length === 1
        && requestedOAuthScopes[0] === OFFLINE_ACCESS_SCOPE
        && hasDiscoveredResourceScopes;
    const isNoScopesSelected = requestedOAuthScopes.length === 0 && hasDiscoveredResourceScopes;
    const filteredOAuthScopes = useMemo(() => {
        const query = oauthScopeSearchInput.trim().toLowerCase();
        if (!query) {
            return discoveredOAuthScopes;
        }

        return discoveredOAuthScopes.filter((scope) => scope.toLowerCase().includes(query));
    }, [discoveredOAuthScopes, oauthScopeSearchInput]);

    const handleCheckedChange = (scope: string, checked: boolean) => {
        onSelectedOAuthScopesChange(checked
            ? normalizeMcpRequestedOAuthScopes([...selectedOAuthScopes, scope])
            : selectedOAuthScopes.filter((selectedScope) => selectedScope !== scope));
    };

    const handleSelectAll = () => {
        onSelectedOAuthScopesChange(normalizeMcpRequestedOAuthScopes([...selectedOAuthScopes, ...filteredOAuthScopes]));
    };

    const handleClear = () => {
        onSelectedOAuthScopesChange([]);
        onCustomOAuthScopeInputChange("");
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <Label>OAuth scopes</Label>
                    <p className="text-xs text-muted-foreground">{requestedOAuthScopes.length} requested</p>
                </div>
                <div className="flex items-center gap-1">
                    {discoveredOAuthScopes.length > 0 && (
                        <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll} disabled={filteredOAuthScopes.length === 0}>
                            {oauthScopeSearchInput.trim() ? "Select shown" : "Select all"}
                        </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={requestedOAuthScopes.length === 0}>
                        Clear
                    </Button>
                </div>
            </div>

            {discoveredOAuthScopes.length > 0 && (
                <div className="space-y-2">
                    <Input
                        value={oauthScopeSearchInput}
                        onChange={(event) => setOAuthScopeSearchInput(event.target.value)}
                        placeholder="Search scopes"
                        className="h-9"
                    />
                    <div className="max-h-56 overflow-y-auto overscroll-contain rounded-md border">
                        {filteredOAuthScopes.length > 0 ? (
                            filteredOAuthScopes.map((scope) => (
                                <div
                                    key={scope}
                                    className="flex min-h-9 items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
                                >
                                    <label className="flex flex-1 cursor-pointer items-center gap-2">
                                        <Checkbox
                                            checked={selectedOAuthScopeSet.has(scope)}
                                            onCheckedChange={(checked) => handleCheckedChange(scope, checked === true)}
                                            aria-label={`Request ${scope}`}
                                        />
                                        <span className="break-all font-mono text-xs">{scope}</span>
                                        {scope === OFFLINE_ACCESS_SCOPE && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="shrink-0 text-muted-foreground" onClick={(event) => event.preventDefault()}>
                                                        <InfoIcon className="h-3.5 w-3.5" />
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-64">
                                                    Required for refresh tokens. Without this scope, users must re-authenticate whenever their access token expires, and some connectors reject authorization entirely.
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </label>
                                    {onRemoveOAuthScope && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => onRemoveOAuthScope(scope)}
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
                <Label htmlFor={customOAuthScopesInputId}>Custom scopes</Label>
                <Textarea
                    id={customOAuthScopesInputId}
                    value={customOAuthScopeInput}
                    onChange={(event) => onCustomOAuthScopeInputChange(event.target.value)}
                    placeholder="e.g. repo, channels:read"
                    className="min-h-20 resize-y font-mono text-sm"
                />
            </div>

            {(isOfflineAccessOnly || isNoScopesSelected) && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    {isOfflineAccessOnly
                        ? "Only offline_access is selected. Without any resource scopes, the connector may not be able to access anything."
                        : "No scopes are selected. Without any resource scopes, the connector may not be able to access anything."}
                </p>
            )}
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
    onEditOAuthScopes: (server: McpConfigurationServer) => void;
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
    onEditOAuthScopes,
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
                                    <DropdownMenuItem onClick={() => onEditOAuthScopes(server)}>
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

function WorkspaceOrgSkillCard({
    skill,
    flagPending,
    isDeleting,
    onFlagChange,
    onDelete,
}: {
    skill: SharedAgentSkillManagementItem;
    flagPending: OrgSkillFlagKey | null;
    isDeleting: boolean;
    onFlagChange: (skill: SharedAgentSkillManagementItem, flag: OrgSkillFlagKey, checked: boolean) => void;
    onDelete: (skill: SharedAgentSkillManagementItem) => void;
}) {
    const isActionPending = isDeleting || flagPending !== null;

    return (
        <Card>
            <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Building2Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{skill.name}</p>
                        <SkillCommandBadge slug={skill.slug} />
                        {skill.featured && <FeaturedSkillBadge />}
                        {skill.autoEnrolled && <AutoEnrolledSkillBadge />}
                    </div>
                    {skill.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {skill.description}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-3 rounded-md border bg-muted/30 px-2 py-1 sm:justify-end">
                    <OrgSkillFlagToggle
                        label="Featured"
                        checked={skill.featured}
                        disabled={flagPending !== null}
                        onCheckedChange={(checked) => onFlagChange(skill, "featured", checked)}
                    />
                    <OrgSkillFlagToggle
                        label="Auto"
                        checked={skill.autoEnrolled}
                        disabled={flagPending !== null}
                        onCheckedChange={(checked) => onFlagChange(skill, "autoEnrolled", checked)}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={isActionPending}
                        onClick={() => onDelete(skill)}
                        aria-label={`Delete ${skill.name}`}
                    >
                        {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2Icon className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export function WorkspaceAskAgentPage({ callbackStatus, callbackServer, callbackMessage, oauthRedirectUrl, initialOrgSkills }: WorkspaceAskAgentPageProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const router = useRouter();
    const didHandleCallbackRef = useRef(false);
    const [orgSkills, setOrgSkills] = useState(() => sortSharedAgentSkillCatalogItems(initialOrgSkills));
    const [flagPendingSkills, setFlagPendingSkills] = useState<Record<string, OrgSkillFlagKey>>({});
    const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);
    const [skillToDelete, setSkillToDelete] = useState<SharedAgentSkillManagementItem | null>(null);

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
    const [isOAuthScopeSelectionDialogOpen, setIsOAuthScopeSelectionDialogOpen] = useState(false);
    const [pendingOAuthScopeSelectionServer, setPendingOAuthScopeSelectionServer] = useState<PendingConnectorServer | null>(null);
    const [knownOAuthScopes, setKnownOAuthScopes] = useState<string[]>([]);
    const [selectedOAuthScopes, setSelectedOAuthScopes] = useState<string[]>([]);
    const [customOAuthScopeInput, setCustomOAuthScopeInput] = useState("");
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdatingOAuthScopes, setIsUpdatingOAuthScopes] = useState(false);
    const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
    const [serverToDelete, setServerToDelete] = useState<McpConfigurationServer | null>(null);
    const [serverToEditOAuthScopes, setServerToEditOAuthScopes] = useState<McpConfigurationServer | null>(null);

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
    const canManageWorkspaceSkills = data?.isAskAgentAvailable === true;
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
    const editedOAuthScopeEntries = useMemo(() => buildMcpOAuthScopeEntries({
        availableOAuthScopes: knownOAuthScopes,
        requestedOAuthScopes: getMcpRequestedOAuthScopes(selectedOAuthScopes, customOAuthScopeInput),
    }), [knownOAuthScopes, selectedOAuthScopes, customOAuthScopeInput]);
    const currentEditedServerRequestedOAuthScopes = useMemo(() => (
        normalizeMcpRequestedOAuthScopes(
            serverToEditOAuthScopes?.oauthScopes
                .filter((entry) => entry.enabled)
                .map((entry) => entry.scope) ?? [],
        )
    ), [serverToEditOAuthScopes]);
    const editedRequestedOAuthScopes = useMemo(() => (
        normalizeMcpRequestedOAuthScopes(
            editedOAuthScopeEntries
                .filter((entry) => entry.enabled)
                .map((entry) => entry.scope),
        )
    ), [editedOAuthScopeEntries]);
    const oauthScopeUpdateReauthConnectionCount = serverToEditOAuthScopes?.savedConnectionCount ?? 0;
    const oauthScopeUpdateRequiresReauth = !!serverToEditOAuthScopes &&
        oauthScopeUpdateReauthConnectionCount > 0 &&
        !oauthScopesEqual(currentEditedServerRequestedOAuthScopes, editedRequestedOAuthScopes);

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

    const resetOAuthScopeInputs = () => {
        setSelectedOAuthScopes([]);
        setCustomOAuthScopeInput("");
    };

    // Pre-select offline_access so admins can see the scope token refresh depends on;
    // they can still untick it to opt out of refresh tokens.
    const initializeOAuthScopeSelection = (discoveredOAuthScopes: string[]) => {
        setSelectedOAuthScopes(discoveredOAuthScopes.includes(OFFLINE_ACCESS_SCOPE) ? [OFFLINE_ACCESS_SCOPE] : []);
        setCustomOAuthScopeInput("");
    };

    const handleCloseClientCredentialsDialog = () => {
        setIsClientCredentialsDialogOpen(false);
        setPendingClientCredentialsServer(null);
        setClientId("");
        setClientSecret("");
        resetOAuthScopeInputs();
    };

    const handleCloseOAuthScopeSelectionDialog = () => {
        setIsOAuthScopeSelectionDialogOpen(false);
        setPendingOAuthScopeSelectionServer(null);
        resetOAuthScopeInputs();
    };

    const handleOpenEditOAuthScopesDialog = (server: McpConfigurationServer) => {
        setServerToEditOAuthScopes(server);
        setKnownOAuthScopes(normalizeMcpRequestedOAuthScopes(server.oauthScopes.map((entry) => entry.scope)));
        setSelectedOAuthScopes(normalizeMcpRequestedOAuthScopes(
            server.oauthScopes.filter((entry) => entry.enabled).map((entry) => entry.scope),
        ));
        setCustomOAuthScopeInput("");
    };

    const handleCloseEditOAuthScopesDialog = () => {
        setServerToEditOAuthScopes(null);
        setKnownOAuthScopes([]);
        resetOAuthScopeInputs();
    };

    const handleRemoveKnownOAuthScope = (scope: string) => {
        setKnownOAuthScopes((currentOAuthScopes) => currentOAuthScopes.filter((currentScope) => currentScope !== scope));
        setSelectedOAuthScopes((currentOAuthScopes) => currentOAuthScopes.filter((currentScope) => currentScope !== scope));
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
                requestedOAuthScopes: getMcpRequestedOAuthScopes(selectedOAuthScopes, customOAuthScopeInput),
                availableOAuthScopes: pendingClientCredentialsServer.discoveredOAuthScopes,
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
        if (!pendingOAuthScopeSelectionServer) {
            toast({ title: "Error", description: "Missing connector details", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const result = await createMcpServer(
                pendingOAuthScopeSelectionServer.name,
                pendingOAuthScopeSelectionServer.serverUrl,
                getMcpRequestedOAuthScopes(selectedOAuthScopes, customOAuthScopeInput),
                pendingOAuthScopeSelectionServer.discoveredOAuthScopes,
            );
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to add connector: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
            handleCloseOAuthScopeSelectionDialog();
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

                const discoveredOAuthScopes = normalizeMcpRequestedOAuthScopes(dcrSupport.oauthScopesSupported);
                if (dcrSupport.isKnown && !dcrSupport.supportsDcr) {
                    initializeOAuthScopeSelection(discoveredOAuthScopes);
                    setPendingClientCredentialsServer({
                        name: displayName,
                        serverUrl: normalizedServerUrl,
                        discoveredOAuthScopes,
                    });
                    setIsCreateDialogOpen(false);
                    setIsClientCredentialsDialogOpen(true);
                    return;
                }

                if (discoveredOAuthScopes.length > 0) {
                    initializeOAuthScopeSelection(discoveredOAuthScopes);
                    setPendingOAuthScopeSelectionServer({
                        name: displayName,
                        serverUrl: normalizedServerUrl,
                        discoveredOAuthScopes,
                    });
                    setIsCreateDialogOpen(false);
                    setIsOAuthScopeSelectionDialogOpen(true);
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

    const handleUpdateOAuthScopes = async () => {
        if (!serverToEditOAuthScopes) {
            toast({ title: "Error", description: "Missing connector details", variant: "destructive" });
            return;
        }

        setIsUpdatingOAuthScopes(true);
        try {
            const result = await updateMcpServerOAuthScopes(
                serverToEditOAuthScopes.id,
                editedOAuthScopeEntries,
            );
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to update OAuth scopes: ${result.message}`, variant: "destructive" });
                return;
            }

            await invalidateMcpConfigurationQueries(queryClient);
            handleCloseEditOAuthScopesDialog();
            toast({
                description: result.invalidatedConnectionCount > 0
                    ? `OAuth scopes updated. ${result.invalidatedConnectionCount} saved ${pluralize(result.invalidatedConnectionCount, "connection")} will need to reconnect.`
                    : "OAuth scopes updated.",
            });
        } catch {
            toast({ title: "Error", description: "Failed to update OAuth scopes.", variant: "destructive" });
        } finally {
            setIsUpdatingOAuthScopes(false);
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

    const handleOrgSkillFlagChange = async (
        skill: SharedAgentSkillManagementItem,
        flag: OrgSkillFlagKey,
        checked: boolean,
    ) => {
        if (flagPendingSkills[skill.id] !== undefined) {
            return;
        }

        setFlagPendingSkills((current) => ({
            ...current,
            [skill.id]: flag,
        }));
        try {
            const error = await updateWorkspaceSkillFlag({
                skillId: skill.id,
                flag,
                checked,
                updateOrgSkills: setOrgSkills,
            });
            if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
                return;
            }

            toast({ description: "Shared skill updated." });
        } catch {
            toast({ title: "Error", description: "Failed to update shared skill.", variant: "destructive" });
        } finally {
            setFlagPendingSkills((current) => {
                const next = { ...current };
                delete next[skill.id];
                return next;
            });
        }
    };

    const handleDeleteOrgSkill = async (skillId: string) => {
        if (flagPendingSkills[skillId] !== undefined) {
            return;
        }

        setDeletingSkillId(skillId);
        try {
            const error = await deleteWorkspaceSkill({
                skillId,
                updateOrgSkills: setOrgSkills,
            });
            if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
                return;
            }

            setSkillToDelete(null);
            toast({ description: "Shared skill deleted." });
        } catch {
            toast({ title: "Error", description: "Failed to delete shared skill.", variant: "destructive" });
        } finally {
            setDeletingSkillId(null);
        }
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

            {canManageWorkspaceSkills && (
                <>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h4 className="text-sm font-semibold text-foreground">Shared skills</h4>
                                <p className="text-sm text-muted-foreground">
                                    Manage shared skills available to everyone in your workspace.
                                </p>
                            </div>
                            <p className="shrink-0 text-xs text-muted-foreground">
                                {orgSkills.length} {pluralize(orgSkills.length, "skill")}
                            </p>
                        </div>

                        <div className="space-y-2">
                            {orgSkills.length === 0 ? (
                                <WorkspaceSkillsEmptyState />
                            ) : (
                                orgSkills.map((skill) => (
                                    <WorkspaceOrgSkillCard
                                        key={skill.id}
                                        skill={skill}
                                        flagPending={flagPendingSkills[skill.id] ?? null}
                                        isDeleting={deletingSkillId === skill.id}
                                        onFlagChange={(skillToUpdate, flag, checked) => {
                                            void handleOrgSkillFlagChange(skillToUpdate, flag, checked);
                                        }}
                                        onDelete={(skillToDelete) => {
                                            if (flagPendingSkills[skillToDelete.id] !== undefined) {
                                                return;
                                            }

                                            setSkillToDelete(skillToDelete);
                                        }}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <Separator />
                </>
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
                                    onEditOAuthScopes={handleOpenEditOAuthScopesDialog}
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

            <DeleteWorkspaceSkillDialog
                skill={skillToDelete}
                isDeleting={deletingSkillId !== null}
                disabled={skillToDelete ? flagPendingSkills[skillToDelete.id] !== undefined : false}
                onOpenChange={(open) => {
                    if (!open && deletingSkillId === null) {
                        setSkillToDelete(null);
                    }
                }}
                onConfirm={() => {
                    if (skillToDelete && flagPendingSkills[skillToDelete.id] === undefined) {
                        void handleDeleteOrgSkill(skillToDelete.id);
                    }
                }}
            />

            {/* Add connector dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
                <DialogContent className={cn(scrollableConnectorDialogContentClassName, "sm:max-w-md")}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Add Connector</DialogTitle>
                        <DialogDescription>
                            Add a workspace-approved connector that members can use with Ask Sourcebot.
                        </DialogDescription>
                    </DialogHeader>
                    <div className={cn(scrollableConnectorDialogBodyClassName, "space-y-4")}>
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
                    <DialogFooter className="shrink-0 sm:justify-between">
                        <Button variant="outline" onClick={handleCloseCreateDialog}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={isCreating || !newServerName.trim() || !newServerUrl.trim()}>
                            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {isCreating ? "Checking..." : "Add"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* OAuth scope selection dialog */}
            <Dialog open={isOAuthScopeSelectionDialogOpen} onOpenChange={(open) => {
                if (!open) {
                    handleCloseOAuthScopeSelectionDialog();
                    return;
                }

                setIsOAuthScopeSelectionDialogOpen(true);
            }}>
                <DialogContent className={cn(scrollableConnectorDialogContentClassName, "sm:max-w-lg")}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle>OAuth Scopes</DialogTitle>
                        <DialogDescription>
                            Choose the OAuth scopes Sourcebot should request for this connector.
                        </DialogDescription>
                    </DialogHeader>
                    <div className={cn(scrollableConnectorDialogBodyClassName, "space-y-4")}>
                        {pendingOAuthScopeSelectionServer && (
                            <div className="rounded-md border bg-muted/40 p-3">
                                <p className="text-sm font-medium truncate">{pendingOAuthScopeSelectionServer.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{pendingOAuthScopeSelectionServer.serverUrl}</p>
                            </div>
                        )}
                        <OAuthScopesInput
                            discoveredOAuthScopes={pendingOAuthScopeSelectionServer?.discoveredOAuthScopes ?? []}
                            selectedOAuthScopes={selectedOAuthScopes}
                            customOAuthScopeInput={customOAuthScopeInput}
                            customOAuthScopesInputId="mcp-configuration-dynamic-oauth-scopes"
                            onSelectedOAuthScopesChange={setSelectedOAuthScopes}
                            onCustomOAuthScopeInputChange={setCustomOAuthScopeInput}
                        />
                    </div>
                    <DialogFooter className="shrink-0 sm:justify-between">
                        <Button variant="outline" onClick={handleCloseOAuthScopeSelectionDialog}>Cancel</Button>
                        <Button onClick={handleCreateDynamicOAuthServer} disabled={isCreating}>
                            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Add
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit OAuth scopes dialog */}
            <Dialog open={!!serverToEditOAuthScopes} onOpenChange={(open) => {
                if (!open) {
                    handleCloseEditOAuthScopesDialog();
                    return;
                }
            }}>
                <DialogContent className={cn(scrollableConnectorDialogContentClassName, "sm:max-w-lg")}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Edit OAuth Scopes</DialogTitle>
                        <DialogDescription>
                            Changing OAuth scopes clears saved member authorizations so users can reconnect with the updated scopes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className={cn(scrollableConnectorDialogBodyClassName, "space-y-4")}>
                        {serverToEditOAuthScopes && (
                            <div className="rounded-md border bg-muted/40 p-3">
                                <p className="text-sm font-medium truncate">{serverToEditOAuthScopes.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{serverToEditOAuthScopes.serverUrl}</p>
                            </div>
                        )}
                        <OAuthScopesInput
                            discoveredOAuthScopes={knownOAuthScopes}
                            selectedOAuthScopes={selectedOAuthScopes}
                            customOAuthScopeInput={customOAuthScopeInput}
                            customOAuthScopesInputId="mcp-configuration-edit-oauth-scopes"
                            onSelectedOAuthScopesChange={setSelectedOAuthScopes}
                            onCustomOAuthScopeInputChange={setCustomOAuthScopeInput}
                            onRemoveOAuthScope={handleRemoveKnownOAuthScope}
                        />
                        {oauthScopeUpdateRequiresReauth && (
                            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                <p>
                                    Applying this change will require <span className="font-medium text-destructive">{oauthScopeUpdateReauthConnectionCount} saved {pluralize(oauthScopeUpdateReauthConnectionCount, "connection")}</span> to reconnect.
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="shrink-0 sm:justify-between">
                        <Button variant="outline" onClick={handleCloseEditOAuthScopesDialog}>Cancel</Button>
                        <Button onClick={handleUpdateOAuthScopes} disabled={isUpdatingOAuthScopes}>
                            {isUpdatingOAuthScopes && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
                <DialogContent className={cn(scrollableConnectorDialogContentClassName, "sm:max-w-lg")}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle>OAuth Client Credentials Required</DialogTitle>
                    </DialogHeader>
                    <div className={cn(scrollableConnectorDialogBodyClassName, "space-y-4")}>
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
                            discoveredOAuthScopes={pendingClientCredentialsServer?.discoveredOAuthScopes ?? []}
                            selectedOAuthScopes={selectedOAuthScopes}
                            customOAuthScopeInput={customOAuthScopeInput}
                            customOAuthScopesInputId="mcp-configuration-static-oauth-scopes"
                            onSelectedOAuthScopesChange={setSelectedOAuthScopes}
                            onCustomOAuthScopeInputChange={setCustomOAuthScopeInput}
                        />
                    </div>
                    <DialogFooter className="shrink-0 sm:justify-between">
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
