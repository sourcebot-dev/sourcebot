'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import { type ConnectedOauthClient, revokeMcpClient } from "@/ee/features/oauth/actions";
import { isServiceError } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Boxes, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyIconButton } from "../../components/copyIconButton";
import { SettingsCard, SettingsCardGroup } from "../components/settingsCard";
import { ClientCard } from "./clientCard";
import { MCP_CLIENTS, matchKnownClient } from "./clients";

const DOCS_URL = "https://docs.sourcebot.dev/docs/features/mcp-server";

interface McpPageProps {
    mcpServerUrl: string;
    connectedClients: ConnectedOauthClient[];
}

export function McpPage({
    mcpServerUrl,
    connectedClients
}: McpPageProps) {
    const { toast } = useToast();
    const router = useRouter();

    const handleCopyServerUrl = () => {
        navigator.clipboard.writeText(mcpServerUrl)
            .catch(() => {
                toast({
                    title: "Error",
                    description: "Failed to copy URL to clipboard",
                    variant: "destructive",
                });
            });
        return true;
    };

    const handleRevokeClient = async (clientId: string, name: string) => {
        const result = await revokeMcpClient({ clientId });
        if (isServiceError(result)) {
            toast({
                title: "Error",
                description: `Failed to revoke ${name}: ${result.message}`,
                variant: "destructive",
            });
            return;
        }
        router.refresh();
        toast({ description: `${name} has been disconnected.` });
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">MCP Server</h3>
                <p className="text-sm text-muted-foreground">
                    Connect AI coding tools to search and read your code through Sourcebot&apos;s MCP server. <Link href={DOCS_URL} target="_blank" className="text-link hover:underline">Learn more</Link>
                </p>
            </div>

            <SettingsCard>
                <h4 className="text-sm font-medium mb-2">Server URL</h4>
                <div className="flex items-center gap-2">
                    <div className="bg-muted p-2 rounded-md text-sm flex-1 break-all font-mono">
                        {mcpServerUrl}
                    </div>
                    <CopyIconButton onCopy={handleCopyServerUrl} />
                </div>
            </SettingsCard>

            <div className="flex flex-col gap-2">
                <div>
                    <h4 className="text-base font-medium">Install in a client</h4>
                    <p className="text-sm text-muted-foreground">
                        Set up Sourcebot in your editor or coding agent.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MCP_CLIENTS.map((client) => (
                        <ClientCard key={client.id} client={client} serverUrl={mcpServerUrl} />
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div>
                    <h4 className="text-base font-medium">Connected clients</h4>
                    <p className="text-sm text-muted-foreground">
                        MCP clients that have been authorized to access Sourcebot on your behalf.
                    </p>
                </div>

                {connectedClients.length === 0 ? (
                    <SettingsCard>
                        <div className="py-4 text-center text-sm text-muted-foreground">
                            No clients connected yet.
                        </div>
                    </SettingsCard>
                ) : (
                    <SettingsCardGroup>
                        {connectedClients.map((client) => (
                            <SettingsCard key={client.id}>
                                <div className="group flex items-center gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                                        <ConnectedClientLogo logoUri={client.logoUri} name={client.name} />
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-sm font-medium truncate">{client.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            Connected {formatDistanceToNow(client.connectedAt, { addSuffix: true })}
                                            {" · "}
                                            {client.lastUsedAt
                                                ? `last used ${formatDistanceToNow(client.lastUsedAt, { addSuffix: true })}`
                                                : "never used"
                                            }
                                        </span>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Disconnect {client.name}?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    <span className="font-semibold text-foreground">{client.name}</span> will no longer be able to access Sourcebot. You can reconnect it by re-authorizing from the client. This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleRevokeClient(client.id, client.name)}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Disconnect
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </SettingsCard>
                        ))}
                    </SettingsCardGroup>
                )}
            </div>
        </div>
    );
}

function ConnectedClientLogo({ logoUri, name }: { logoUri: string | null; name: string }) {
    if (logoUri) {
        return (
            <Image
                src={logoUri}
                alt={`${name} logo`}
                width={40}
                height={40}
                unoptimized
                className="h-full w-full object-cover"
            />
        );
    }

    const known = matchKnownClient(name);
    if (known) {
        return (
            <>
                <Image
                    src={known.logoSrc}
                    alt={`${name} logo`}
                    width={24}
                    height={24}
                    className={`h-6 w-6 ${known.logoSrcDark ? 'block dark:hidden' : ''}`}
                />
                {known.logoSrcDark && (
                    <Image
                        src={known.logoSrcDark}
                        alt={`${name} logo`}
                        width={24}
                        height={24}
                        className="h-6 w-6 hidden dark:block"
                    />
                )}
            </>
        );
    }

    return <Boxes className="h-4 w-4 text-muted-foreground" />;
}
