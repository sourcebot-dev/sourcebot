'use client';

import { useMemo, useState } from "react";
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getDisplayServerUrl } from "@/ee/features/chat/mcp/components/connectorRowInfo";
import { McpFavicon } from "@/ee/features/chat/mcp/components/mcpFavicon";
import {
    getAvailablePrefabMcpServers,
    type PrefabMcpServer,
} from "@/ee/features/chat/mcp/prefabMcpServers";
import { getMcpFaviconUrl } from "@/features/chat/mcp/utils";
import { PlusIcon } from "lucide-react";

interface PrefabConnectorPopoverProps {
    configuredServerUrls: string[];
    disabled?: boolean;
    onSelectCustomUrl: () => void;
    onSelectPrefabServer: (server: PrefabMcpServer) => void;
    children?: React.ReactNode;
}

export function PrefabConnectorPopover({
    configuredServerUrls,
    disabled,
    onSelectCustomUrl,
    onSelectPrefabServer,
    children,
}: PrefabConnectorPopoverProps) {
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
                {children ?? (
                    <Button size="icon" variant="ghost" disabled={disabled} aria-label="Add connector">
                        <PlusIcon className="h-4 w-4" />
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0" align="end">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search connectors"
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
                                        <McpFavicon faviconUrl={getMcpFaviconUrl(server.serverUrl, server.name)} className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">{server.name}</p>
                                        <p className="truncate text-muted-foreground">{getDisplayServerUrl(server.serverUrl)}</p>
                                    </div>
                                </CommandItem>
                            ))}
                            {search.trim() && filteredPrefabServers.length === 0 && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    No connectors found.
                                </div>
                            )}
                        </CommandGroup>
                        <CommandGroup className="sticky bottom-0 z-10 border-t bg-popover">
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
