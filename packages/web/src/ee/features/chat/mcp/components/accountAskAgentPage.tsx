'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenIcon, CableIcon, ExternalLink, MoreHorizontal, PencilIcon, PlusIcon, SearchIcon, Settings2Icon, Trash2Icon, Unplug } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectMcpButton } from "@/ee/features/chat/mcp/components/connectMcpButton";
import { ConnectorCard } from "@/ee/features/chat/mcp/components/connectorCard";
import { ConnectorRowInfo } from "@/ee/features/chat/mcp/components/connectorRowInfo";
import { ConnectorToolTrigger } from "@/ee/features/chat/mcp/components/connectorToolDisclosure";
import { useConnectMcp } from "@/ee/features/chat/mcp/hooks/useConnectMcp";
import { useMcpToolMetadata } from "@/ee/features/chat/mcp/hooks/useMcpToolMetadata";
import { disconnectMcpServer } from "@/ee/features/chat/mcp/actions";
import { deletePersonalAgentSkill } from "@/ee/features/chat/skills/actions";
import { sortAgentSkillListItems, type AgentSkillListItem } from "@/ee/features/chat/skills/types";
import { invalidateMcpConfigurationQueries, mcpQueryKeys } from "@/ee/features/chat/mcp/queryKeys";
import { pluralize } from "@/features/chat/mcp/utils";
import { cn, isServiceError } from "@/lib/utils";
import type { McpServerWithStatus } from "@/app/api/(server)/ee/askmcp/servers/route";
import type { ServerToolsEntry } from "@/ee/features/chat/mcp/types";

type FilterTab = "all" | "connected";

function clearCallbackParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete('status');
    url.searchParams.delete('server');
    url.searchParams.delete('message');
    window.history.replaceState({}, '', url.toString());
}

interface AccountAskAgentPageProps {
    callbackStatus?: string;
    callbackServer?: string;
    callbackMessage?: string;
    canManageConnectors: boolean;
    initialPersonalSkills: AgentSkillListItem[];
}

const newSkillHref = "/settings/accountAskAgent/skills/new";
const editSkillHref = (skill: AgentSkillListItem) => `/settings/accountAskAgent/skills/${skill.id}`;

function PersonalSkillCard({
    skill,
    onDelete,
}: {
    skill: AgentSkillListItem;
    onDelete: (skill: AgentSkillListItem) => void;
}) {
    return (
        <Card>
            <CardContent className="flex items-start gap-3 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <BookOpenIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{skill.name}</p>
                        <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            /{skill.slug}
                        </span>
                    </div>
                    {skill.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {skill.description}
                        </p>
                    )}
                </div>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link href={editSkillHref(skill)}>
                                <PencilIcon className="h-4 w-4 mr-2" />
                                Edit
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(skill)}
                        >
                            <Trash2Icon className="h-4 w-4 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardContent>
        </Card>
    );
}

function PersonalSkillsEmptyState() {
    return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted p-3 mb-4">
                    <BookOpenIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                    No skills yet
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Create a personal slash command for prompts you reuse in Ask Sourcebot.
                </p>
                <Button asChild variant="outline" className="mt-4">
                    <Link href={newSkillHref}>
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Create skill
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}

export function AccountAskAgentEmptyState({ canManageConnectors }: { canManageConnectors: boolean }) {
    return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-3 mb-4">
                    <CableIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                    {canManageConnectors ? "No connectors configured yet" : "No connectors available"}
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                    {canManageConnectors
                        ? "Open Workspace Ask Sourcebot to approve connectors for your workspace."
                        : "No connectors have been approved for this workspace yet. Contact your workspace admin."}
                </p>
                {canManageConnectors && (
                    <Button asChild variant="outline" className="mt-4">
                        <Link href="/settings/workspaceAskAgent">
                            <Settings2Icon className="h-4 w-4 mr-2" />
                            Open Workspace Ask Sourcebot
                        </Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

interface AccountConnectedConnectorCardProps {
    server: McpServerWithStatus;
    toolEntry?: ServerToolsEntry;
    isToolsLoading: boolean;
    isToolsError: boolean;
    onRetryTools: () => void;
    onReconnect: (serverId: string) => void;
    onDisconnect: (server: McpServerWithStatus) => void;
    disconnectingServerId: string | null;
}

function AccountConnectedConnectorCard({
    server,
    toolEntry,
    isToolsLoading,
    isToolsError,
    onRetryTools,
    onReconnect,
    onDisconnect,
    disconnectingServerId,
}: AccountConnectedConnectorCardProps) {
    return (
        <ConnectorCard
            faviconUrl={server.faviconUrl}
            name={server.name}
            serverUrl={server.serverUrl}
            isConnected={server.isConnected}
            isAuthExpired={server.isAuthExpired}
            toolEntry={server.isConnected ? toolEntry : undefined}
            isToolsLoading={isToolsLoading}
            isToolsError={isToolsError}
            onRetryTools={onRetryTools}
            statusBadge={
                <>
                    {server.isConnected && (
                        <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500/80" />
                            Connected
                        </span>
                    )}
                    {server.isAuthExpired && (
                        <span className="inline-flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500/80" />
                            Authorization expired
                        </span>
                    )}
                </>
            }
            actionButtons={
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onReconnect(server.id)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Reconnect
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={disconnectingServerId === server.id}
                            onClick={() => onDisconnect(server)}
                        >
                            <Unplug className="h-4 w-4 mr-2" />
                            {disconnectingServerId === server.id ? "Disconnecting..." : "Disconnect"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            }
        />
    );
}

function AccountSuggestedConnectorCard({ server }: { server: McpServerWithStatus }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3 p-3">
                <ConnectorRowInfo
                    faviconUrl={server.faviconUrl}
                    name={server.name}
                    serverUrl={server.serverUrl}
                    size="sm"
                >
                    <div className="mt-0.5 flex items-center text-[11px]">
                        <ConnectorToolTrigger
                            isConnected={false}
                            isAuthExpired={false}
                        />
                    </div>
                </ConnectorRowInfo>
                <ConnectMcpButton
                    serverId={server.id}
                    isConnected={false}
                    isAuthExpired={false}
                    size="sm"
                    variant="outline"
                    className="h-8"
                />
            </CardContent>
        </Card>
    );
}

export function AccountAskAgentPage({
    callbackStatus,
    callbackServer,
    callbackMessage,
    canManageConnectors,
    initialPersonalSkills,
}: AccountAskAgentPageProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const didHandleCallbackRef = useRef(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<FilterTab>("all");
    const [personalSkills, setPersonalSkills] = useState(() => sortAgentSkillListItems(initialPersonalSkills));
    const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);
    const [confirmDeleteSkill, setConfirmDeleteSkill] = useState<AgentSkillListItem | null>(null);
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
            toast({ title: "Connection failed", description: callbackMessage ?? 'Failed to connect connector.', variant: "destructive" });
            clearCallbackParams();
        }
    }, [callbackStatus, callbackServer, callbackMessage, toast]);

    const { data: servers = [], isLoading, isError } = useQuery({
        queryKey: mcpQueryKeys.serversWithStatus,
        queryFn: async () => {
            const result = await getMcpServersWithStatus();
            if (isServiceError(result)) {
                throw new Error("Failed to load connectors");
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
    const activeConnectedServerCount = useMemo(
        () => servers.filter((s) => s.isConnected).length,
        [servers],
    );
    const {
        isToolsLoading,
        isToolsError,
        refetchTools,
        toolsByServerId,
    } = useMcpToolMetadata(true, activeConnectedServerCount);

    const handleDisconnect = async (serverId: string) => {
        setDisconnectingServerId(serverId);
        setConfirmDisconnectServer(null);
        try {
            const result = await disconnectMcpServer(serverId, 'account_settings');
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to disconnect: ${result.message}`, variant: "destructive" });
                return;
            }
            toast({ description: "Connector disconnected." });
            await invalidateMcpConfigurationQueries(queryClient);
        } catch {
            toast({ title: "Error", description: "Failed to disconnect connector.", variant: "destructive" });
        } finally {
            setDisconnectingServerId(null);
        }
    };

    const handleDeleteSkill = async (skill: AgentSkillListItem) => {
        setDeletingSkillId(skill.id);
        try {
            const result = await deletePersonalAgentSkill(skill.id);
            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }

            setPersonalSkills((current) => current.filter((item) => item.id !== skill.id));
            setConfirmDeleteSkill(null);
            toast({ description: "Skill deleted." });
        } catch {
            toast({ title: "Error", description: "Failed to delete skill.", variant: "destructive" });
        } finally {
            setDeletingSkillId(null);
        }
    };

    const isDeletingConfirmedSkill = deletingSkillId !== null && deletingSkillId === confirmDeleteSkill?.id;

    const skillsSection = (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h4 className="text-sm font-semibold text-foreground">Skills</h4>
                    <p className="text-sm text-muted-foreground max-w-lg">
                        Manage personal slash-command workflows for Ask Sourcebot.
                    </p>
                </div>
                {personalSkills.length > 0 && (
                    <Button asChild variant="outline" size="sm" className="self-start">
                        <Link href={newSkillHref}>
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Create skill
                        </Link>
                    </Button>
                )}
            </div>

            {personalSkills.length === 0 ? (
                <PersonalSkillsEmptyState />
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Personal
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {personalSkills.length} {pluralize(personalSkills.length, "skill")}
                        </p>
                    </div>
                    {personalSkills.map((skill) => (
                        <PersonalSkillCard
                            key={skill.id}
                            skill={skill}
                            onDelete={setConfirmDeleteSkill}
                        />
                    ))}
                </div>
            )}
        </div>
    );

    const skillDialogs = (
        <>
            <AlertDialog
                open={confirmDeleteSkill !== null}
                onOpenChange={(open) => {
                    if (!open && !isDeletingConfirmedSkill) {
                        setConfirmDeleteSkill(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Skill</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <span className="font-semibold text-foreground">{confirmDeleteSkill?.name}</span>? This will remove the <span className="font-mono text-foreground">/{confirmDeleteSkill?.slug}</span> command.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingConfirmedSkill}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isDeletingConfirmedSkill}
                            onClick={(event) => {
                                event.preventDefault();
                                if (confirmDeleteSkill) {
                                    void handleDeleteSkill(confirmDeleteSkill);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeletingConfirmedSkill ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );

    if (isError) {
        return <div>Error loading connectors</div>;
    }

    if (!isLoading && servers.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h3 className="text-lg font-medium">Ask Sourcebot</h3>
                    <p className="text-sm text-muted-foreground max-w-lg">
                        Manage your personal Ask Sourcebot setup.
                    </p>
                </div>
                <Separator />
                {skillsSection}
                <Separator />
                <div className="space-y-3">
                    <div>
                        <h4 className="text-sm font-semibold text-foreground">Connectors</h4>
                        <p className="text-sm text-muted-foreground max-w-lg">
                            Manage workspace-approved connectors for use with Ask Sourcebot.
                        </p>
                    </div>
                    <AccountAskAgentEmptyState canManageConnectors={canManageConnectors} />
                </div>
                {skillDialogs}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Ask Sourcebot</h3>
                <p className="text-sm text-muted-foreground max-w-lg">
                    Manage your personal Ask Sourcebot setup.
                </p>
            </div>

            <Separator />
            {skillsSection}
            <Separator />

            <div className="space-y-3">
                <div>
                    <h4 className="text-sm font-semibold text-foreground">Connectors</h4>
                    <p className="text-sm text-muted-foreground max-w-lg">
                        Manage workspace-approved connectors for use with Ask Sourcebot.
                    </p>
                </div>

                {/* Search + filter bar */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search connectors..."
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
                                {connectedServers.length} {pluralize(connectedServers.length, "connector")}
                            </p>
                        </div>

                        {visibleConnected.length === 0 ? (
                            <Card>
                                <CardContent className="flex items-center justify-center py-8">
                                    <p className="text-sm text-muted-foreground">
                                        {searchQuery.trim()
                                            ? "No connected connectors match your search."
                                            : "No connectors connected yet."}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            visibleConnected.map((server) => (
                                <AccountConnectedConnectorCard
                                    key={server.id}
                                    server={server}
                                    toolEntry={toolsByServerId.get(server.id)}
                                    isToolsLoading={isToolsLoading}
                                    isToolsError={isToolsError}
                                    onRetryTools={() => { void refetchTools(); }}
                                    onReconnect={reconnectMcp}
                                    onDisconnect={(serverToDisconnect) => setConfirmDisconnectServer({
                                        id: serverToDisconnect.id,
                                        name: serverToDisconnect.name || serverToDisconnect.serverUrl,
                                    })}
                                    disconnectingServerId={disconnectingServerId}
                                />
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
                                                ? "No suggested connectors match your search."
                                                : "All connectors are connected."}
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                visibleSuggested.map((server) => (
                                    <AccountSuggestedConnectorCard key={server.id} server={server} />
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
                        <AlertDialogTitle>Disconnect Connector</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to disconnect from <span className="font-semibold text-foreground">{confirmDisconnectServer?.name}</span>? Your stored credentials for this connector will be removed.
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

            {skillDialogs}
        </div>
    );
}
