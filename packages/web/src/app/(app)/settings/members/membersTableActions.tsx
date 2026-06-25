"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { OrgRole } from "@sourcebot/db";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/hooks/use-toast";
import {
    approveAccountRequest,
    cancelInvite,
    leaveOrg,
    reactivateMember,
    rejectAccountRequest,
    removeMemberFromOrg,
    suspendMember,
} from "@/features/membership/actions";
import { demoteToMember, promoteToOwner } from "@/ee/features/membership/actions";
import { type ServiceError } from "@/lib/serviceError";
import { createPathWithQueryParams, isServiceError } from "@/lib/utils";
import { type TableRowData } from "./membersTable";

type MemberAction =
    | "promote"
    | "demote"
    | "suspend"
    | "reactivate"
    | "remove"
    | "leave"
    | "cancelInvite"
    | "approveRequest"
    | "rejectRequest";

export interface MembersTableActionsProps {
    row: TableRowData;
    currentUserId: string;
    activeOwnerCount: number;
    hasOrgManagement: boolean;
    scimEnabled: boolean;
}

const getDisplayName = (row: TableRowData) => {
    if (row.kind === "invite") {
        return row.email;
    }
    return row.name ?? row.email;
};

const getActionLabel = (action: MemberAction) => {
    switch (action) {
        case "promote":
            return "Promote";
        case "demote":
            return "Demote";
        case "suspend":
            return "Suspend";
        case "reactivate":
            return "Reactivate";
        case "remove":
            return "Remove";
        case "leave":
            return "Leave";
        case "cancelInvite":
            return "Cancel invite";
        case "approveRequest":
            return "Approve";
        case "rejectRequest":
            return "Reject";
    }
};

const getDialogCopy = (action: MemberAction, row: TableRowData) => {
    const name = getDisplayName(row);

    switch (action) {
        case "promote":
            return {
                title: "Promote to Owner",
                description: `Are you sure you want to promote ${name} to owner? They will have full administrative access.`,
            };
        case "demote":
            return {
                title: "Demote to Member",
                description: `Are you sure you want to demote ${name} from owner to member? They will lose administrative access.`,
            };
        case "suspend":
            return {
                title: "Suspend Member",
                description: `Are you sure you want to suspend ${name}? They will lose access to this organization.`,
            };
        case "reactivate":
            return {
                title: "Reactivate Member",
                description: `Are you sure you want to reactivate ${name}? They will regain access to this organization.`,
            };
        case "remove":
            return {
                title: "Remove Member",
                description: `Are you sure you want to permanently remove ${name} from this organization?`,
            };
        case "leave":
            return {
                title: "Leave Organization",
                description: "Are you sure you want to leave this organization?",
            };
        case "cancelInvite":
            return {
                title: "Cancel Invite",
                description: `Are you sure you want to cancel the invite for ${row.email}?`,
            };
        case "approveRequest":
            return {
                title: "Approve Request",
                description: `Are you sure you want to approve the request from ${row.email}? They will be added as a member to your organization.`,
            };
        case "rejectRequest":
            return {
                title: "Reject Request",
                description: `Are you sure you want to reject the request from ${row.email}?`,
            };
    }
};

const isDestructiveAction = (action: MemberAction) => {
    return ["demote", "suspend", "remove", "leave", "cancelInvite", "rejectRequest"].includes(action);
};

export const MembersTableActions = ({
    row,
    currentUserId,
    activeOwnerCount,
    hasOrgManagement,
    scimEnabled,
}: MembersTableActionsProps) => {
    const router = useRouter();
    const { toast } = useToast();
    const [pendingAction, setPendingAction] = useState<MemberAction | null>(null);
    const [confirmingAction, setConfirmingAction] = useState<MemberAction | null>(null);
    const isCurrentUser = row.kind === "member" && row.id === currentUserId;
    const isLastActiveOwner = row.kind === "member"
        && row.isActive
        && row.role === OrgRole.OWNER
        && activeOwnerCount <= 1;
    const scimDisabledTitle = scimEnabled ? "SCIM provisioning is enabled" : undefined;

    const copyEmail = async () => {
        try {
            await navigator.clipboard.writeText(row.email);
            toast({ description: "Email copied to clipboard." });
        } catch {
            toast({ description: "Failed to copy email." });
        }
    };

    const copyInviteLink = async () => {
        if (row.kind !== "invite") {
            return;
        }

        try {
            const url = createPathWithQueryParams(`${window.location.origin}/redeem?invite_id=${row.id}`);
            await navigator.clipboard.writeText(url);
            toast({ description: "Invite link copied to clipboard." });
        } catch {
            toast({ description: "Failed to copy invite link." });
        }
    };

    const runConfirmedAction = async () => {
        if (confirmingAction == null) {
            return;
        }

        const action = confirmingAction;
        setPendingAction(action);

        let result: { success: boolean } | ServiceError;
        try {
            result = await (async () => {
                switch (action) {
                    case "promote":
                        return promoteToOwner(row.id);
                    case "demote":
                        return demoteToMember(row.id);
                    case "suspend":
                        return suspendMember(row.id);
                    case "reactivate":
                        return reactivateMember(row.id);
                    case "remove":
                        return removeMemberFromOrg(row.id);
                    case "leave":
                        return leaveOrg();
                    case "cancelInvite":
                        return cancelInvite(row.id);
                    case "approveRequest":
                        return approveAccountRequest(row.id);
                    case "rejectRequest":
                        return rejectAccountRequest(row.id);
                }
            })();
        } catch {
            toast({ description: `Failed to ${getActionLabel(action).toLowerCase()}.` });
            return;
        } finally {
            setPendingAction(null);
        }

        if (isServiceError(result)) {
            toast({
                description: `Failed to ${getActionLabel(action).toLowerCase()}. Reason: ${result.message}`,
            });
            return;
        }

        toast({ description: `${getActionLabel(action)} successful.` });
        setConfirmingAction(null);
        router.refresh();
    };

    const dialogCopy = confirmingAction == null ? null : getDialogCopy(confirmingAction, row);
    const confirmButtonClassName = confirmingAction != null && isDestructiveAction(confirmingAction)
        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
        : undefined;

    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Open member actions">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem className="cursor-pointer" onClick={copyEmail}>
                        Copy email
                    </DropdownMenuItem>
                    {row.kind === "invite" && (
                        <>
                            <DropdownMenuItem className="cursor-pointer" onClick={copyInviteLink}>
                                Copy invite link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer text-destructive"
                                onClick={() => setConfirmingAction("cancelInvite")}
                            >
                                Cancel invite
                            </DropdownMenuItem>
                        </>
                    )}
                    {row.kind === "request" && (
                        <>
                            <DropdownMenuItem
                                className="cursor-pointer"
                                disabled={scimEnabled}
                                title={scimDisabledTitle}
                                onClick={() => setConfirmingAction("approveRequest")}
                            >
                                Approve request
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer text-destructive"
                                onClick={() => setConfirmingAction("rejectRequest")}
                            >
                                Reject request
                            </DropdownMenuItem>
                        </>
                    )}
                    {row.kind === "member" && (
                        <>
                            {row.role === OrgRole.MEMBER && (
                                <DropdownMenuItem
                                    className="cursor-pointer"
                                    disabled={!hasOrgManagement}
                                    title={!hasOrgManagement ? "Organization management is not available in your current plan" : undefined}
                                    onClick={() => setConfirmingAction("promote")}
                                >
                                    Promote to owner
                                </DropdownMenuItem>
                            )}
                            {row.role === OrgRole.OWNER && (
                                <DropdownMenuItem
                                    className="cursor-pointer text-destructive"
                                    disabled={!hasOrgManagement || isLastActiveOwner}
                                    title={
                                        !hasOrgManagement
                                            ? "Organization management is not available in your current plan"
                                            : isLastActiveOwner
                                                ? "Cannot demote the last active owner"
                                                : undefined
                                    }
                                    onClick={() => setConfirmingAction("demote")}
                                >
                                    Demote to member
                                </DropdownMenuItem>
                            )}
                            {row.isActive ? (
                                isCurrentUser ? (
                                    <DropdownMenuItem
                                        className="cursor-pointer text-destructive"
                                        disabled={scimEnabled || isLastActiveOwner}
                                        title={scimDisabledTitle ?? (isLastActiveOwner ? "Cannot leave as the last active owner" : undefined)}
                                        onClick={() => setConfirmingAction("leave")}
                                    >
                                        Leave organization
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem
                                        className="cursor-pointer text-destructive"
                                        disabled={scimEnabled || isLastActiveOwner}
                                        title={scimDisabledTitle ?? (isLastActiveOwner ? "Cannot suspend the last active owner" : undefined)}
                                        onClick={() => setConfirmingAction("suspend")}
                                    >
                                        Suspend
                                    </DropdownMenuItem>
                                )
                            ) : (
                                <>
                                    <DropdownMenuItem
                                        className="cursor-pointer"
                                        disabled={scimEnabled}
                                        title={scimDisabledTitle}
                                        onClick={() => setConfirmingAction("reactivate")}
                                    >
                                        Reactivate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer text-destructive"
                                        disabled={scimEnabled}
                                        title={scimDisabledTitle}
                                        onClick={() => setConfirmingAction("remove")}
                                    >
                                        Remove
                                    </DropdownMenuItem>
                                </>
                            )}
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={confirmingAction != null} onOpenChange={(open) => {
                if (!open) {
                    setConfirmingAction(null);
                }
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{dialogCopy?.title}</AlertDialogTitle>
                        <AlertDialogDescription>{dialogCopy?.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pendingAction != null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className={confirmButtonClassName}
                            disabled={pendingAction != null}
                            onClick={(event) => {
                                event.preventDefault();
                                runConfirmedAction();
                            }}
                        >
                            {confirmingAction == null ? "Confirm" : getActionLabel(confirmingAction)}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
