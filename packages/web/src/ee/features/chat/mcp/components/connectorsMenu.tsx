'use client';

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { connectMcpToAsk, getMcpServersWithStatus } from "@/app/api/(client)/client";
import { useToast } from "@/components/hooks/use-toast";
import { McpFavicon } from "@/ee/features/chat/mcp/components/mcpFavicon";
import { mcpQueryKeys } from "@/ee/features/chat/mcp/queryKeys";
import { isServiceError } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangleIcon, CableIcon, Loader2Icon, PlusCircleIcon, PlusIcon, RefreshCwIcon, SettingsIcon } from "lucide-react";
import { PlusButtonInfoCard } from "@/features/chat/components/chatBox/plusButtonInfoCard";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSlate } from "slate-react";
import { Editor } from "slate";
import type { CustomEditor, SearchScope } from "@/features/chat/types";
import {
    clearMcpOAuthDraft,
    consumeMcpOAuthDraftForPath,
    createMcpOAuthDraftPath,
    saveMcpOAuthDraft,
} from "@/features/chat/mcpOAuthDraft";
import { clearEditorHistory, resetEditor } from "@/features/chat/utils";
import { useRole } from "@/features/auth/useRole";
import { OrgRole } from "@sourcebot/db";

interface ConnectorsMenuProps {
    selectedSearchScopes: SearchScope[];
    onSelectedSearchScopesChange: (items: SearchScope[]) => void;
    disabledMcpServerIds: string[];
    onDisabledMcpServerIdsChange: (ids: string[]) => void;
}

interface ChatMenuMcpServer {
    isConnected: boolean;
    isAuthExpired: boolean;
}

export function splitMcpServersForChatMenu<T extends ChatMenuMcpServer>(servers: T[]) {
    return {
        connectedServers: servers.filter((server) => server.isConnected || server.isAuthExpired),
        connectableServers: servers.filter((server) => !server.isConnected && !server.isAuthExpired),
    };
}

function restoreEditorChildren(editor: CustomEditor, children: CustomEditor['children']) {
    editor.children = children;
    editor.selection = {
        anchor: Editor.end(editor, []),
        focus: Editor.end(editor, []),
    };
    clearEditorHistory(editor);
    editor.onChange();
}

export const ConnectorsMenu = ({
    selectedSearchScopes,
    onSelectedSearchScopesChange,
    disabledMcpServerIds,
    onDisabledMcpServerIdsChange,
}: ConnectorsMenuProps) => {
    const [connectingServerId, setConnectingServerId] = useState<string | null>(null);
    const editor = useSlate();
    const hasRestoredMcpOAuthDraft = useRef(false);
    const isMountedRef = useRef(false);
    const queryClient = useQueryClient();
    const router = useRouter();
    const { toast } = useToast();
    const isOwner = useRole() === OrgRole.OWNER;

    const { data: servers = [], isError, isLoading, refetch } = useQuery({
        queryKey: mcpQueryKeys.serversWithStatus,
        queryFn: async () => {
            const result = await getMcpServersWithStatus();
            if (isServiceError(result)) {
                throw new Error("Failed to load connectors");
            }
            return result;
        },
    });

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (hasRestoredMcpOAuthDraft.current) {
            return;
        }

        const currentPath = createMcpOAuthDraftPath(window.location.pathname, window.location.search);
        if (!currentPath) {
            return;
        }

        const draft = consumeMcpOAuthDraftForPath(currentPath);
        if (!draft) {
            return;
        }

        hasRestoredMcpOAuthDraft.current = true;

        try {
            restoreEditorChildren(editor, draft.children);
            onSelectedSearchScopesChange(draft.selectedSearchScopes);
            onDisabledMcpServerIdsChange(draft.disabledMcpServerIds);
        } catch (error) {
            resetEditor(editor);
            editor.onChange();
            console.error('Failed to restore MCP OAuth draft:', error);
        }
    }, [editor, onDisabledMcpServerIdsChange, onSelectedSearchScopesChange]);

    const onToggle = (serverId: string, checked: boolean) => {
        if (checked) {
            onDisabledMcpServerIdsChange(disabledMcpServerIds.filter((id) => id !== serverId));
        } else {
            onDisabledMcpServerIdsChange([...disabledMcpServerIds, serverId]);
        }
    };

    const handleConnect = async (serverId: string) => {
        setConnectingServerId(serverId);
        const returnTo = createMcpOAuthDraftPath(window.location.pathname, window.location.search) ?? '/chat';

        saveMcpOAuthDraft({
            returnTo,
            children: editor.children,
            selectedSearchScopes,
            disabledMcpServerIds,
        });

        try {
            const result = await connectMcpToAsk({
                serverId,
                returnTo,
            });

            if (!isMountedRef.current) {
                return;
            }

            if (isServiceError(result)) {
                clearMcpOAuthDraft();
                toast({
                    description: `Failed to connect connector. ${result.message}`,
                    variant: "destructive",
                });
                setConnectingServerId(null);
                return;
            }

            if (result.authorizationUrl) {
                window.location.href = result.authorizationUrl;
                return;
            }

            clearMcpOAuthDraft();
            toast({ description: 'Connector is already connected.' });
            await queryClient.invalidateQueries({ queryKey: mcpQueryKeys.serversWithStatus });
            if (!isMountedRef.current) {
                return;
            }
            setConnectingServerId(null);
        } catch {
            if (!isMountedRef.current) {
                return;
            }

            clearMcpOAuthDraft();
            toast({
                description: "Failed to connect connector.",
                variant: "destructive",
            });
            setConnectingServerId(null);
            return;
        }
    };

    const { connectedServers, connectableServers } = splitMcpServersForChatMenu(servers);
    const hasServers = connectedServers.length > 0 || connectableServers.length > 0;

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 text-muted-foreground hover:text-primary"
                        >
                            <PlusIcon className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="p-0 border-0 bg-transparent shadow-none">
                    <PlusButtonInfoCard />
                </TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="bottom" align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                        <CableIcon className="w-4 h-4 text-muted-foreground" />
                        Connectors
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                        {isError && !hasServers ? (
                            <DropdownMenuItem
                                onSelect={(e) => {
                                    e.preventDefault();
                                    refetch();
                                }}
                                className="gap-2 text-destructive"
                            >
                                <RefreshCwIcon className="w-4 h-4" />
                                Failed to load. Retry?
                            </DropdownMenuItem>
                        ) : isLoading ? (
                            <DropdownMenuItem disabled>
                                Loading connectors...
                            </DropdownMenuItem>
                        ) : !hasServers ? (
                            <DropdownMenuItem disabled>
                                No connectors available
                            </DropdownMenuItem>
                        ) : (
                            <>
                                {connectedServers.map((server) => {
                                    const isEnabled = !server.isAuthExpired && !disabledMcpServerIds.includes(server.id);
                                    return (
                                        <DropdownMenuItem
                                            key={server.id}
                                            onSelect={(e) => e.preventDefault()}
                                            disabled={server.isAuthExpired}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {server.isAuthExpired ? (
                                                    <AlertTriangleIcon className="w-4 h-4 shrink-0 text-yellow-500" />
                                                ) : (
                                                    <McpFavicon faviconUrl={server.faviconUrl} className="w-4 h-4 rounded-sm" />
                                                )}
                                                <span className="truncate text-sm">{server.name}</span>
                                            </div>
                                            <Switch
                                                checked={isEnabled}
                                                onCheckedChange={(checked) => onToggle(server.id, checked)}
                                                disabled={server.isAuthExpired}
                                                className="scale-75"
                                            />
                                        </DropdownMenuItem>
                                    );
                                })}
                                {connectedServers.length > 0 && connectableServers.length > 0 && <DropdownMenuSeparator />}
                                {connectableServers.map((server) => (
                                    <DropdownMenuItem
                                        key={server.id}
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            void handleConnect(server.id);
                                        }}
                                        disabled={connectingServerId !== null}
                                        className="group flex cursor-pointer items-center justify-between gap-2"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <McpFavicon faviconUrl={server.faviconUrl} className="w-4 h-4 rounded-sm" />
                                            <span className="truncate text-sm">{server.name}</span>
                                        </div>
                                        {connectingServerId === server.id ? (
                                            <Loader2Icon className="w-4 h-4 shrink-0 animate-spin text-muted-foreground" />
                                        ) : (
                                            <PlusCircleIcon className="w-4 h-4 shrink-0 text-green-600/80 transition-colors group-focus:text-green-500 group-hover:text-green-500 dark:text-green-400/80 dark:group-focus:text-green-400 dark:group-hover:text-green-400" />
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="gap-2 text-muted-foreground"
                            onSelect={() => router.push(`/settings/accountAskAgent`)}
                        >
                            <CableIcon className="w-4 h-4" />
                            My connectors
                        </DropdownMenuItem>
                        {isOwner && (
                            <DropdownMenuItem
                                className="gap-2 text-muted-foreground"
                                onSelect={() => router.push(`/settings/workspaceAskAgent`)}
                            >
                                <SettingsIcon className="w-4 h-4" />
                                Workspace connectors
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
