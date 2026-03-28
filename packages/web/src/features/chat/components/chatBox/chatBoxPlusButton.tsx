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
import { getMcpServersWithStatus } from "@/app/api/(client)/client";
import { isServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangleIcon, Plug, PlusIcon, RefreshCwIcon, ServerIcon, SettingsIcon } from "lucide-react";
import { PlusButtonInfoCard } from "./plusButtonInfoCard";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

interface ChatBoxPlusButtonProps {
    disabledMcpServerIds: string[];
    onDisabledMcpServerIdsChange: (ids: string[]) => void;
}

export const ChatBoxPlusButton = ({
    disabledMcpServerIds,
    onDisabledMcpServerIdsChange,
}: ChatBoxPlusButtonProps) => {
    const [failedFavicons, setFailedFavicons] = useState<Set<string>>(new Set());
    const router = useRouter();
    const { domain } = useParams<{ domain: string }>();

    const { data: servers, isError, refetch } = useQuery({
        queryKey: ['mcpServersWithStatus'],
        queryFn: async () => {
            const result = await getMcpServersWithStatus();
            if (isServiceError(result)) {
                throw new Error("Failed to load MCP servers");
            }
            return result;
        },
    });

    const onToggle = (serverId: string, checked: boolean) => {
        if (checked) {
            onDisabledMcpServerIdsChange(disabledMcpServerIds.filter((id) => id !== serverId));
        } else {
            onDisabledMcpServerIdsChange([...disabledMcpServerIds, serverId]);
        }
    };

    const onFaviconError = (serverId: string) => {
        setFailedFavicons((prev) => new Set(prev).add(serverId));
    };

    // Only surface servers the user has attempted to connect (connected or auth expired).
    const relevantServers = servers?.filter((s) => s.isConnected || s.isAuthExpired) ?? [];

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
                        <ServerIcon className="w-4 h-4 text-muted-foreground" />
                        MCP Servers
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                        {isError && relevantServers.length === 0 ? (
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
                        ) : relevantServers.length === 0 ? (
                            <DropdownMenuItem disabled>
                                No MCP servers connected
                            </DropdownMenuItem>
                        ) : (
                            relevantServers.map((server) => {
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
                                            ) : failedFavicons.has(server.id) ? (
                                                <Plug className="w-4 h-4 shrink-0 text-muted-foreground" />
                                            ) : (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={server.faviconUrl}
                                                    onError={() => onFaviconError(server.id)}
                                                    className="w-4 h-4 shrink-0 rounded-sm"
                                                    alt=""
                                                />
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
                            })
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="gap-2 text-muted-foreground"
                            onSelect={() => router.push(`/${domain}/settings/mcpServers`)}
                        >
                            <SettingsIcon className="w-4 h-4" />
                            Manage MCP servers
                        </DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
