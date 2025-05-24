'use client';

import { createApiKey, getUserApiKeys } from "@/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isServiceError } from "@/lib/utils";
import { Copy, Check, AlertTriangle, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDomain } from "@/hooks/useDomain";
import { useToast } from "@/components/hooks/use-toast";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { DataTable } from "@/components/ui/data-table";
import { columns, ApiKeyColumnInfo } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApiKeysPage() {
    const domain = useDomain();
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();
    
    const [apiKeys, setApiKeys] = useState<{ name: string; createdAt: Date; lastUsedAt: Date | null }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [isCreatingKey, setIsCreatingKey] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadApiKeys = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const keys = await getUserApiKeys(domain);
            if (isServiceError(keys)) {
                setError("Failed to load API keys");
                toast({
                    title: "Error",
                    description: "Failed to load API keys",
                    variant: "destructive",
                });
                return;
            }
            setApiKeys(keys);
        } catch (error) {
            console.error(error);
            setError("Failed to load API keys");
            toast({
                title: "Error",
                description: "Failed to load API keys",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [domain, toast]);

    useEffect(() => {
        loadApiKeys();
    }, [loadApiKeys]);

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
            const result = await createApiKey(newKeyName.trim(), domain);
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
            await loadApiKeys();
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
        if (!newlyCreatedKey) return;
        
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

    const tableData = useMemo(() => {
        if (isLoading) return Array(4).fill(null).map(() => ({
            name: "",
            createdAt: "",
            lastUsedAt: null,
        }));

        if (!apiKeys) return [];
        
        return apiKeys.map((key): ApiKeyColumnInfo => ({
            name: key.name,
            createdAt: key.createdAt.toISOString(),
            lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        })).sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [apiKeys, isLoading]);

    const tableColumns = useMemo(() => {
        if (isLoading) {
            return columns().map((column) => {
                if ('accessorKey' in column && column.accessorKey === "name") {
                    return {
                        ...column,
                        cell: () => (
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-4 rounded-md" /> {/* Icon skeleton */}
                                <Skeleton className="h-4 w-48" /> {/* Name skeleton */}
                            </div>
                        ),
                    }
                }

                return {
                    ...column,
                    cell: () => <Skeleton className="h-4 w-24" />,
                }
            })
        }

        return columns();
    }, [isLoading]);

    if (error) {
        return <div>Error loading API keys</div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-row items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">API Keys</h3>
                    <p className="text-sm text-muted-foreground">Create and manage API keys for programmatic access to Sourcebot.</p>
                </div>

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => {
                            setNewlyCreatedKey(null);
                            setNewKeyName("");
                            setIsCreateDialogOpen(true);
                        }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create API Key
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
            </div>

            <DataTable
                columns={tableColumns}
                data={tableData}
                searchKey="name"
                searchPlaceholder="Search API keys..."
            />
        </div>
    );
}