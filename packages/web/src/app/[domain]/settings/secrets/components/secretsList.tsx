'use client';

import { Input } from "@/components/ui/input";
import { LucideKeyRound, MoreVertical, Search, LucideTrash } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDisplayTime, isServiceError } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteSecret } from "@/actions";
import { useDomain } from "@/hooks/useDomain";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";
import { CodeSnippet } from "@/app/components/codeSnippet";

interface Secret {
    key: string;
    createdAt: Date;
}

interface SecretsListProps {
    secrets: Secret[];
}

export const SecretsList = ({ secrets }: SecretsListProps) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest");
    const [secretToDelete, setSecretToDelete] = useState<Secret | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const domain = useDomain();
    const { toast } = useToast();
    const router = useRouter();

    const filteredSecrets = useMemo(() => {
        return secrets
            .filter((secret) => {
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch = secret.key.toLowerCase().includes(searchLower);
                return matchesSearch;
            })
            .sort((a, b) => {
                return dateSort === "newest"
                    ? b.createdAt.getTime() - a.createdAt.getTime()
                    : a.createdAt.getTime() - b.createdAt.getTime()
            });
    }, [secrets, searchQuery, dateSort]);

    const onDeleteSecret = useCallback(() => {
        deleteSecret(secretToDelete?.key ?? "", domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to delete secret. Reason: ${response.message}`
                    })
                } else {
                    toast({
                        description: `✅ Secret deleted successfully.`
                    });
                    router.refresh();
                }
            })
    }, [domain, secretToDelete?.key, toast, router]);

    return (
        <div className="w-full mx-auto space-y-6">
            <div className="flex gap-4 flex-col sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter by secret name..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <Select value={dateSort} onValueChange={(value) => setDateSort(value as "newest" | "oldest")}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="oldest">Oldest</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto divide-y">
                    {secrets.length === 0 || (filteredSecrets.length === 0 && searchQuery.length > 0) ? (
                        <div className="flex flex-col items-center justify-center h-96 p-4">
                            <p className="font-medium text-sm">No Secrets Found</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                {filteredSecrets.length === 0 && searchQuery.length > 0 ? "No secrets found matching your filters." : "Use the form above to create a new secret."}
                            </p>
                        </div>
                    ) : (
                        filteredSecrets.map((secret) => (
                            <div key={secret.key} className="p-4 flex items-center justify-between bg-background">
                                <div className="flex items-center">
                                    <LucideKeyRound className="w-4 h-4 mr-2" />
                                    <p className="font-mono">{secret.key}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <p className="text-sm text-muted-foreground">
                                        Created {getDisplayTime(secret.createdAt)}
                                    </p>
                                    <DropdownMenu modal={false}>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    className="cursor-pointer text-destructive"
                                                    onClick={() => {
                                                        setSecretToDelete(secret);
                                                        setIsDeleteDialogOpen(true);
                                                    }}
                                                >
                                                    <LucideTrash className="w-4 h-4 mr-2" />
                                                    Delete secret
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                </div>
            <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Secret</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the secret <CodeSnippet>{secretToDelete?.key}</CodeSnippet>? Any connections that use this secret will <strong>fail to sync.</strong>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={onDeleteSecret}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
