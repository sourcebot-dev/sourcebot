'use client';

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import { Check, Copy, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { SettingsCard } from "../components/settingsCard";
import { type McpClient, buildClientAction } from "./clients";

interface ClientCardProps {
    client: McpClient;
    serverUrl: string;
}

export function ClientCard({ client, serverUrl }: ClientCardProps) {
    const { toast } = useToast();
    const [commandCopied, setCommandCopied] = useState(false);
    const action = buildClientAction(client.id, serverUrl);

    const handleCopyCommand = (command: string) => {
        navigator.clipboard.writeText(command)
            .then(() => {
                setCommandCopied(true);
                setTimeout(() => setCommandCopied(false), 2000);
            })
            .catch(() => {
                toast({
                    title: "Error",
                    description: "Failed to copy command",
                    variant: "destructive",
                });
            });
    };

    return (
        <SettingsCard>
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted overflow-hidden">
                        <Image
                            src={client.logoSrc}
                            alt={`${client.name} logo`}
                            width={24}
                            height={24}
                            className={`h-6 w-6 ${client.logoSrcDark ? 'block dark:hidden' : ''}`}
                        />
                        {client.logoSrcDark && (
                            <Image
                                src={client.logoSrcDark}
                                alt={`${client.name} logo`}
                                width={24}
                                height={24}
                                className="h-6 w-6 hidden dark:block"
                            />
                        )}
                    </div>
                    <span className="text-sm font-medium">{client.name}</span>
                </div>
                {action.type === 'deeplink' && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => { window.location.href = action.href; }}
                    >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Install
                    </Button>
                )}
                {action.type === 'command' && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleCopyCommand(action.command)}
                    >
                        {commandCopied ? (
                            <Check className="h-4 w-4 mr-2 text-green-500" />
                        ) : (
                            <Copy className="h-4 w-4 mr-2" />
                        )}
                        {commandCopied ? 'Copied' : 'Copy command'}
                    </Button>
                )}
                {action.type === 'docs' && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => window.open(action.href, '_blank', 'noopener,noreferrer')}
                    >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Setup instructions
                    </Button>
                )}
            </div>
        </SettingsCard>
    );
}
