'use client';

import { createApiKey, deleteApiKey } from "@/actions";
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
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

interface ApiKey {
    name: string;
    createdAt: Date;
    lastUsedAt: Date | null;
}

interface ApiKeysPageProps {
    canCreateApiKey: boolean;
    apiKeys: ApiKey[];
}

export function ApiKeysPage({ canCreateApiKey, apiKeys }: ApiKeysPageProps) {
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();
    const router = useRouter();

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [isCreatingKey, setIsCreatingKey] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCreateApiKey = async () => {
        if (!newKeyName.trim()) {
            toast({
                title: "Error",
                description: "API key name cannot be empty",
                variant: "destructive",
            });
            return;
        }

        setIsCreatingKey(true);
        try {
            const result = await createApiKey(newKeyName.trim());
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: `Failed to create API key: ${result.message}`,
                    variant: "destructive",
                });
                captureEvent('wa_api_key_creation_fail', {});
                return;
            }

            setNewlyCreatedKey(result.key);
            router.refresh();
            captureEvent('wa_api_key_created', {});
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: `Failed to create API key: ${error}`,
                variant: "destructive",
            });
            captureEvent('wa_api_key_creation_fail', {});
        } finally {
            setIsCreatingKey(false);
        }
    };

    const handleCopyApiKey = () => {
        if (!newlyCreatedKey) {
            return;
        }

        navigator.clipboard.writeText(newlyCreatedKey)
            .then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            })
            .catch(() => {
                toast({
                    title: "Error",
                    description: "Failed to copy API key to clipboard",
                    variant: "destructive",
                });
            });
    };

    const handleCloseDialog = () => {
        setIsCreateDialogOpen(false);
        setNewKeyName("");
        setNewlyCreatedKey(null);
        setCopySuccess(false);
    };

    const handleDeleteApiKey = async (name: string) => {
        try {
            await deleteApiKey(name);
            router.refresh();
            toast({ description: "API key deleted" });
        } catch (error) {
            console.error("Failed to delete API key", error);
            toast({
                title: "Error",
                description: `Failed to delete API key: ${error}`,
                variant: "destructive",
            });
        }
    };

    const sortedKeys = useMemo(
        () => [...apiKeys].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        [apiKeys]
    );

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h3 className="text-lg font-medium">API Keys</h3>
                <p className="text-sm text-muted-foreground">
                    Create and manage API keys for programmatic access to Sourcebot on your behalf.
                </p>
            </div>

            <div className="border border-border rounded-lg bg-card">
                <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                        {apiKeys.length} API key{apiKeys.length !== 1 ? "s" : ""}
                    </span>

                    <TooltipProvider>
                        <Tooltip>
                            {!canCreateApiKey && (
                                <TooltipContent>
                                    API key creation is restricted.
                                </TooltipContent>
                            )}
                            <TooltipTrigger asChild>
                                <span className={!canCreateApiKey ? "cursor-not-allowed" : undefined}>
                                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={!canCreateApiKey}
                                                className={!canCreateApiKey ? "pointer-events-none" : undefined}
                                                onClick={() => {
                                                    setNewlyCreatedKey(null);
                                                    setNewKeyName("");
                                                    setIsCreateDialogOpen(true);
                                                }}
                                            >
                                                <Plus className="h-4 w-4" />
                                                New API key
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>{newlyCreatedKey ? 'Your New API Key' : 'Create API Key'}</DialogTitle>
                                            </DialogHeader>

                                            {newlyCreatedKey ? (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 p-3 border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-yellow-700 dark:text-yellow-400">
                                                        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                                                        <p className="text-sm">
                                                            This is the only time you&apos;ll see this API key. Make sure to copy it now.
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center space-x-2">
                                                        <div className="bg-muted p-2 rounded-md text-sm flex-1 break-all font-mono">
                                                            {newlyCreatedKey}
                                                        </div>
                                                        <Button
                                                            size="icon"
                                                            variant="outline"
                                                            onClick={handleCopyApiKey}
                                                        >
                                                            {copySuccess ? (
                                                                <Check className="h-4 w-4 text-green-500" />
                                                            ) : (
                                                                <Copy className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-4">
                                                    <Input
                                                        value={newKeyName}
                                                        onChange={(e) => setNewKeyName(e.target.value)}
                                                        placeholder="Enter a name for your API key"
                                                        className="mb-2"
                                                    />
                                                </div>
                                            )}

                                            <DialogFooter className="sm:justify-between">
                                                {newlyCreatedKey ? (
                                                    <Button onClick={handleCloseDialog}>
                                                        Done
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button variant="outline" onClick={handleCloseDialog}>
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            onClick={handleCreateApiKey}
                                                            disabled={isCreatingKey || !newKeyName.trim()}
                                                        >
                                                            {isCreatingKey && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                            Create
                                                        </Button>
                                                    </>
                                                )}
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </span>
                            </TooltipTrigger>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {sortedKeys.length === 0 ? (
                    <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
                        No API keys yet.
                    </div>
                ) : (
                    <div className="border-t border-border">
                        {sortedKeys.map((key) => (
                            <div
                                key={key.name}
                                className="group flex items-center gap-4 px-4 py-4 border-b border-border last:border-b-0"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-medium truncate">{key.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        Created {formatDistanceToNow(key.createdAt, { addSuffix: true })}
                                        {" · "}
                                        {key.lastUsedAt
                                            ? `last used ${formatDistanceToNow(key.lastUsedAt, { addSuffix: true })}`
                                            : "never used"
                                        }
                                    </span>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to delete the API key <span className="font-semibold text-foreground">{key.name}</span>? Any applications using this key will no longer be able to access the API. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => handleDeleteApiKey(key.name)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Delete
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
