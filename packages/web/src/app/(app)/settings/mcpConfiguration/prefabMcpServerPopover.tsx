'use client';

import { useMemo, useState } from "react";
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { McpFavicon } from "@/ee/features/mcp/components/mcpFavicon";
import {
    getAvailablePrefabMcpServers,
    type PrefabMcpServer,
} from "@/ee/features/mcp/prefabMcpServers";
import { getMcpFaviconUrl } from "@/ee/features/mcp/utils";
import { PlusIcon } from "lucide-react";

interface PrefabMcpServerPopoverProps {
    configuredServerUrls: string[];
    disabled?: boolean;
    onSelectCustomUrl: () => void;
    onSelectPrefabServer: (server: PrefabMcpServer) => void;
}

function getDisplayServerUrl(serverUrl: string) {
    try {
        const url = new URL(serverUrl);
        return `${url.host}${url.pathname}${url.search}`.replace(/\/$/, "");
    } catch {
        return serverUrl;
    }
}

export function PrefabMcpServerPopover({
    configuredServerUrls,
    disabled,
    onSelectCustomUrl,
    onSelectPrefabServer,
}: PrefabMcpServerPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");

    const availablePrefabServers = useMemo(() => (
        getAvailablePrefabMcpServers(configuredServerUrls)
    ), [configuredServerUrls]);

    const filteredPrefabServers = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        if (!normalizedSearch) {
            return availablePrefabServers;
        }

        return availablePrefabServers.filter((server) => server.name.toLowerCase().includes(normalizedSearch));
    }, [availablePrefabServers, search]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);

        if (!open) {
            setSearch("");
        }
    };

    const handleSelectPrefabServer = (server: PrefabMcpServer) => {
        handleOpenChange(false);
        onSelectPrefabServer(server);
    };

    const handleSelectCustomUrl = () => {
        handleOpenChange(false);
        onSelectCustomUrl();
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" disabled={disabled} aria-label="Add MCP server">
                    <PlusIcon className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0" align="end">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search servers"
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandGroup>
                            {filteredPrefabServers.map((server) => (
                                <CommandItem
                                    key={server.id}
                                    value={server.name}
                                    onSelect={() => handleSelectPrefabServer(server)}
                                    className="cursor-pointer"
                                >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                                        <McpFavicon faviconUrl={getMcpFaviconUrl(server.serverUrl)} className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">{server.name}</p>
                                        <p className="truncate text-muted-foreground">{getDisplayServerUrl(server.serverUrl)}</p>
                                    </div>
                                </CommandItem>
                            ))}
                            {search.trim() && filteredPrefabServers.length === 0 && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    No servers found.
                                </div>
                            )}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                            <CommandItem
                                value="Custom URL"
                                onSelect={handleSelectCustomUrl}
                                className="cursor-pointer"
                            >
                                <PlusIcon className="h-4 w-4 text-muted-foreground" />
                                <span>Custom URL...</span>
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
