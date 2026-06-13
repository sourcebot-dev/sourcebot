'use client';

import { generateScimToken, revokeScimToken } from "@/ee/features/scim/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { isServiceError } from "@/lib/utils";
import { Copy, Check, AlertTriangle, Loader2, KeyRound, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

interface ScimToken {
    name: string;
    createdAt: Date;
    lastUsedAt: Date | null;
}

interface ScimProvisioningSettingsProps {
    baseUrl: string;
    tokens: ScimToken[];
}

export function ScimProvisioningSettings({ baseUrl, tokens }: ScimProvisioningSettingsProps) {
    const { toast } = useToast();
    const router = useRouter();

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newTokenName, setNewTokenName] = useState("");
    const [isCreatingToken, setIsCreatingToken] = useState(false);
    const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [baseUrlCopied, setBaseUrlCopied] = useState(false);

    const handleCopyBaseUrl = () => {
        navigator.clipboard.writeText(baseUrl)
            .then(() => {
                setBaseUrlCopied(true);
                setTimeout(() => setBaseUrlCopied(false), 2000);
            })
            .catch(() => {
                toast({ title: "Error", description: "Failed to copy base URL", variant: "destructive" });
            });
    };

    const handleCreateToken = async () => {
        if (!newTokenName.trim()) {
            toast({ title: "Error", description: "Token name cannot be empty", variant: "destructive" });
            return;
        }

        setIsCreatingToken(true);
        try {
            const result = await generateScimToken(newTokenName.trim());
            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to create SCIM token: ${result.message}`, variant: "destructive" });
                return;
            }
            setNewlyCreatedToken(result.token);
            router.refresh();
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: `Failed to create SCIM token: ${error}`, variant: "destructive" });
        } finally {
            setIsCreatingToken(false);
        }
    };

    const handleCopyToken = () => {
        if (!newlyCreatedToken) {
            return;
        }
        navigator.clipboard.writeText(newlyCreatedToken)
            .then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            })
            .catch(() => {
                toast({ title: "Error", description: "Failed to copy token to clipboard", variant: "destructive" });
            });
    };

    const handleCloseDialog = () => {
        setIsCreateDialogOpen(false);
        setNewTokenName("");
        setNewlyCreatedToken(null);
        setCopySuccess(false);
    };

    const handleRevokeToken = async (name: string) => {
        const result = await revokeScimToken(name);
        if (isServiceError(result)) {
            toast({ title: "Error", description: `Failed to revoke SCIM token: ${result.message}`, variant: "destructive" });
            return;
        }
        router.refresh();
        toast({ description: "SCIM token revoked" });
    };

    const sortedTokens = useMemo(
        () => [...tokens].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        [tokens]
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">SCIM connector base URL</span>
                <div className="flex items-center space-x-2">
                    <div className="bg-muted p-2 rounded-md text-sm flex-1 break-all font-mono">
                        {baseUrl}
                    </div>
                    <Button size="icon" variant="outline" onClick={handleCopyBaseUrl}>
                        {baseUrlCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            <div className="border border-border rounded-lg bg-card">
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                        {tokens.length} SCIM token{tokens.length !== 1 ? "s" : ""}
                    </span>

                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setNewlyCreatedToken(null);
                                    setNewTokenName("");
                                    setIsCreateDialogOpen(true);
                                }}
                            >
                                <Plus className="h-4 w-4" />
                                New SCIM token
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>{newlyCreatedToken ? 'Your New SCIM Token' : 'Create SCIM Token'}</DialogTitle>
                            </DialogHeader>

                            {newlyCreatedToken ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 p-3 border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-yellow-700 dark:text-yellow-400">
                                        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                                        <p className="text-sm">
                                            This is the only time you&apos;ll see this token. Copy it now and paste it into your IdP.
                                        </p>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <div className="bg-muted p-2 rounded-md text-sm flex-1 break-all font-mono">
                                            {newlyCreatedToken}
                                        </div>
                                        <Button size="icon" variant="outline" onClick={handleCopyToken}>
                                            {copySuccess ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-4">
                                    <Input
                                        value={newTokenName}
                                        onChange={(e) => setNewTokenName(e.target.value)}
                                        placeholder="Enter a name for your SCIM token"
                                        className="mb-2"
                                    />
                                </div>
                            )}

                            <DialogFooter className="sm:justify-between">
                                {newlyCreatedToken ? (
                                    <Button onClick={handleCloseDialog}>Done</Button>
                                ) : (
                                    <>
                                        <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                                        <Button onClick={handleCreateToken} disabled={isCreatingToken || !newTokenName.trim()}>
                                            {isCreatingToken && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Create
                                        </Button>
                                    </>
                                )}
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {sortedTokens.length === 0 ? (
                    <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        No SCIM tokens yet.
                    </div>
                ) : (
                    <div className="border-t border-border">
                        {sortedTokens.map((token) => (
                            <div
                                key={token.name}
                                className="group flex items-center gap-4 px-4 py-4 border-b border-border last:border-b-0"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-medium truncate">{token.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        Created {formatDistanceToNow(token.createdAt, { addSuffix: true })}
                                        {" · "}
                                        {token.lastUsedAt
                                            ? `last used ${formatDistanceToNow(token.lastUsedAt, { addSuffix: true })}`
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
                                            <AlertDialogTitle>Revoke SCIM Token</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to revoke <span className="font-semibold text-foreground">{token.name}</span>? Your IdP will no longer be able to provision or deprovision users with this token. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => handleRevokeToken(token.name)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Revoke
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
