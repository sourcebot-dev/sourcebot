'use client';

import { useToast } from "@/components/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { isServiceError } from "@/lib/utils";
import {
    createServiceAccountAction,
    reactivateServiceAccountAction,
    removeServiceAccountAction,
    renameServiceAccountAction,
    setServiceAccountRoleAction,
    suspendServiceAccountAction,
} from "@/features/serviceAccounts/actions";
import type { ServiceAccountSummary } from "@/features/serviceAccounts/serviceAccount.service";
import { OrgRole } from "@sourcebot/db";
import { formatDistanceToNow } from "date-fns";
import { KeyRound, MoreVertical, Plus, Server } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ServiceAccountsPageProps {
    serviceAccounts: ServiceAccountSummary[];
}

export function ServiceAccountsPage({ serviceAccounts }: ServiceAccountsPageProps) {
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();
    const router = useRouter();

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newRole, setNewRole] = useState<OrgRole>(OrgRole.MEMBER);
    const [isCreating, setIsCreating] = useState(false);

    const [editingAccount, setEditingAccount] = useState<ServiceAccountSummary | null>(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const openEditDialog = (serviceAccount: ServiceAccountSummary) => {
        setEditingAccount(serviceAccount);
        setEditName(serviceAccount.name ?? "");
        setEditDescription(serviceAccount.description ?? "");
    };

    const handleSaveEdit = async () => {
        if (!editingAccount || !editName.trim()) {
            return;
        }

        setIsSavingEdit(true);
        try {
            const result = await renameServiceAccountAction(editingAccount.id, {
                name: editName.trim(),
                description: editDescription.trim() || undefined,
            });

            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to update service account: ${result.message}`, variant: "destructive" });
                return;
            }

            setEditingAccount(null);
            router.refresh();
            toast({ description: "Service account updated" });
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) {
            toast({ title: "Error", description: "Service account name cannot be empty", variant: "destructive" });
            return;
        }

        setIsCreating(true);
        try {
            const result = await createServiceAccountAction({
                name: newName.trim(),
                description: newDescription.trim() || undefined,
                role: newRole,
            });

            if (isServiceError(result)) {
                toast({ title: "Error", description: `Failed to create service account: ${result.message}`, variant: "destructive" });
                captureEvent('wa_service_account_creation_fail', {});
                return;
            }

            setIsCreateDialogOpen(false);
            setNewName("");
            setNewDescription("");
            setNewRole(OrgRole.MEMBER);
            router.refresh();
            captureEvent('wa_service_account_created', {});
            toast({ description: `Service account "${result.name}" created` });
        } finally {
            setIsCreating(false);
        }
    };

    const handleSetRole = async (id: string, role: OrgRole) => {
        const result = await setServiceAccountRoleAction(id, role);
        if (isServiceError(result)) {
            toast({ title: "Error", description: `Failed to change role: ${result.message}`, variant: "destructive" });
            return;
        }
        router.refresh();
    };

    const handleSuspend = async (id: string, suspend: boolean) => {
        const result = suspend ? await suspendServiceAccountAction(id) : await reactivateServiceAccountAction(id);
        if (isServiceError(result)) {
            toast({ title: "Error", description: `Failed to ${suspend ? 'suspend' : 'reactivate'} service account: ${result.message}`, variant: "destructive" });
            return;
        }
        router.refresh();
        toast({ description: suspend ? "Service account suspended" : "Service account reactivated" });
    };

    const handleRemove = async (id: string) => {
        const result = await removeServiceAccountAction(id);
        if (isServiceError(result)) {
            toast({ title: "Error", description: `Failed to remove service account: ${result.message}`, variant: "destructive" });
            return;
        }
        router.refresh();
        captureEvent('wa_service_account_removed', {});
        toast({ description: "Service account removed" });
    };

    return (
        <div className="border border-border rounded-lg bg-card">
            <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">
                    {serviceAccounts.length} service account{serviceAccounts.length !== 1 ? "s" : ""}
                </span>

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                            <Plus className="h-4 w-4" />
                            New service account
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Create Service Account</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-3 py-2">
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Name (e.g. CI Pipeline)"
                            />
                            <Textarea
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                placeholder="Description (optional)"
                                rows={2}
                            />
                            <Select value={newRole} onValueChange={(value) => setNewRole(value as OrgRole)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={OrgRole.MEMBER}>Member</SelectItem>
                                    <SelectItem value={OrgRole.OWNER}>Owner</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={isCreating || !newName.trim()}>
                                Create
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {serviceAccounts.length === 0 ? (
                <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    No service accounts yet.
                </div>
            ) : (
                <div className="border-t border-border">
                    {serviceAccounts.map((serviceAccount) => (
                        <div
                            key={serviceAccount.id}
                            className="group flex items-center gap-4 px-4 py-4 border-b border-border last:border-b-0"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                                <Server className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium truncate">{serviceAccount.name}</span>
                                    <Badge variant={serviceAccount.role === OrgRole.OWNER ? "default" : "secondary"} className="text-[10px]">
                                        {serviceAccount.role}
                                    </Badge>
                                    {serviceAccount.suspendedAt && (
                                        <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
                                    )}
                                </div>
                                {serviceAccount.description && (
                                    <span className="text-xs text-muted-foreground truncate">{serviceAccount.description}</span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                    Created {formatDistanceToNow(serviceAccount.joinedAt, { addSuffix: true })}
                                    {" · "}
                                    {serviceAccount.lastActiveAt
                                        ? `last used ${formatDistanceToNow(serviceAccount.lastActiveAt, { addSuffix: true })}`
                                        : "never used"}
                                </span>
                            </div>

                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/settings/serviceAccounts/${serviceAccount.id}`}>
                                    <KeyRound className="h-4 w-4" />
                                    Manage keys
                                </Link>
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="flex-shrink-0">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditDialog(serviceAccount)}>
                                        Edit details
                                    </DropdownMenuItem>
                                    {serviceAccount.role === OrgRole.MEMBER ? (
                                        <DropdownMenuItem onClick={() => handleSetRole(serviceAccount.id, OrgRole.OWNER)}>
                                            Promote to Owner
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onClick={() => handleSetRole(serviceAccount.id, OrgRole.MEMBER)}>
                                            Demote to Member
                                        </DropdownMenuItem>
                                    )}
                                    {serviceAccount.suspendedAt ? (
                                        <DropdownMenuItem onClick={() => handleSuspend(serviceAccount.id, false)}>
                                            Reactivate
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem onClick={() => handleSuspend(serviceAccount.id, true)}>
                                            Suspend
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onSelect={(e) => e.preventDefault()}
                                            >
                                                Remove
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Remove Service Account</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to remove <span className="font-semibold text-foreground">{serviceAccount.name}</span>? All of its API keys will stop working immediately. This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleRemove(serviceAccount.id)}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Remove
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={editingAccount !== null} onOpenChange={(open) => !open && setEditingAccount(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Service Account</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-2">
                        <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Name"
                        />
                        <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Description (optional)"
                            rows={2}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingAccount(null)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={isSavingEdit || !editName.trim()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
