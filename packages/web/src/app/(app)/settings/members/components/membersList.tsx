'use client';

import { Input } from "@/components/ui/input";
import { Search, MoreVertical } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCallback, useMemo, useState } from "react";
import { OrgRole } from "@prisma/client";
import { UserAvatar } from "@/components/userAvatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { promoteToOwner, demoteToMember } from "@/ee/features/userManagement/actions";
import { leaveOrg, removeMemberFromOrg } from "@/features/userManagement/actions";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import Link from "next/link";

type Member = {
    id: string
    email: string
    name?: string
    role: OrgRole
    joinedAt: Date
    avatarUrl?: string
}

export interface MembersListProps {
    members: Member[],
    currentUserId: string,
    currentUserRole: OrgRole,
    orgName: string,
    hasOrgManagement: boolean,
}

const ROLES_AND_PERMISSIONS_DOCS_LINK = "https://docs.sourcebot.dev/docs/configuration/auth/roles-and-permissions#managing-owners"

export const MembersList = ({ members, currentUserId, currentUserRole, orgName, hasOrgManagement }: MembersListProps) => {
    const [searchQuery, setSearchQuery] = useState("")
    const [roleFilter, setRoleFilter] = useState<"all" | OrgRole>("all")
    const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest")
    const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)
    const [memberToPromote, setMemberToPromote] = useState<Member | null>(null)
    const [memberToDemote, setMemberToDemote] = useState<Member | null>(null)
    const { toast } = useToast()
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
    const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false)
    const [isDemoteDialogOpen, setIsDemoteDialogOpen] = useState(false)
    const [isLeaveOrgDialogOpen, setIsLeaveOrgDialogOpen] = useState(false)
    const router = useRouter();
    const captureEvent = useCaptureEvent();

    const ownerCount = useMemo(() => members.filter(m => m.role === OrgRole.OWNER).length, [members]);

    const filteredMembers = useMemo(() => {
        return members
            .filter((member) => {
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch =
                    member.name?.toLowerCase().includes(searchLower) || member.email.toLowerCase().includes(searchLower);
                const matchesRole = roleFilter === "all" || member.role === roleFilter;
                return matchesSearch && matchesRole;
            })
            .sort((a, b) => {
                return dateSort === "newest"
                    ? b.joinedAt.getTime() - a.joinedAt.getTime()
                    : a.joinedAt.getTime() - b.joinedAt.getTime()
            });
    }, [members, searchQuery, roleFilter, dateSort]);

    const onRemoveMember = useCallback((memberId: string) => {
        removeMemberFromOrg(memberId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to remove member. Reason: ${response.message}`
                    })
                    captureEvent('wa_members_list_remove_member_fail', {
                        errorCode: response.errorCode,
                    })
                } else {
                    toast({
                        description: `✅ Member removed successfully.`
                    })
                    captureEvent('wa_members_list_remove_member_success', {})
                    router.refresh();
                }
            });
    }, [toast, router, captureEvent]);

    const onPromoteToOwner = useCallback((memberId: string) => {
        promoteToOwner(memberId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to promote member. Reason: ${response.message}`
                    })
                    captureEvent('wa_members_list_promote_to_owner_fail', {
                        errorCode: response.errorCode,
                    })
                } else {
                    toast({
                        description: `✅ Member promoted to owner.`
                    })
                    captureEvent('wa_members_list_promote_to_owner_success', {})
                    router.refresh();
                }
            });
    }, [toast, router, captureEvent]);

    const onDemoteToMember = useCallback((memberId: string) => {
        demoteToMember(memberId)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to demote owner. Reason: ${response.message}`
                    })
                    captureEvent('wa_members_list_demote_to_member_fail', {
                        errorCode: response.errorCode,
                    })
                } else {
                    toast({
                        description: `✅ Owner demoted to member.`
                    })
                    captureEvent('wa_members_list_demote_to_member_success', {})
                    router.refresh();
                }
            });
    }, [toast, router, captureEvent]);

    const onLeaveOrg = useCallback(() => {
        leaveOrg()
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to leave organization. Reason: ${response.message}`
                    })
                    captureEvent('wa_members_list_leave_org_fail', {
                        errorCode: response.errorCode,
                    })
                } else {
                    toast({
                        description: `✅ You have left the organization.`
                    })
                    captureEvent('wa_members_list_leave_org_success', {})
                    router.refresh();
                }
            });
    }, [toast, router, captureEvent]);

    return (
        <div>
            <div className="w-full mx-auto space-y-6">
                <div className="flex gap-4 flex-col sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter by name or email..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as "all" | OrgRole)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Team Roles" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Team Roles</SelectItem>
                            <SelectItem value={OrgRole.OWNER}>Owner</SelectItem>
                            <SelectItem value={OrgRole.MEMBER}>Member</SelectItem>
                        </SelectContent>
                    </Select>

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
                        {filteredMembers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-96 p-4">
                                <p className="font-medium text-sm">No Members Found</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    No members found matching your filters.
                                </p>
                            </div>
                        ) : (
                            filteredMembers.map((member) => (
                                <div key={member.id} className="p-4 flex items-center justify-between bg-background">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar
                                            email={member.email}
                                            imageUrl={member.avatarUrl}
                                        />
                                        <div>
                                            <div className="font-medium">{member.name}</div>
                                            <div className="text-sm text-muted-foreground">{member.email}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-muted-foreground capitalize">{member.role.toLowerCase()}</span>
                                        <DropdownMenu modal={false}>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    className="cursor-pointer"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(member.email)
                                                            .then(() => {
                                                                toast({
                                                                    description: `✅ Email copied to clipboard.`
                                                                })
                                                            })
                                                            .catch(() => {
                                                                toast({
                                                                    description: `❌ Failed to copy email.`
                                                                })
                                                            })
                                                    }}
                                                >
                                                    Copy email
                                                </DropdownMenuItem>
                                                {member.id !== currentUserId && currentUserRole === OrgRole.OWNER && member.role !== OrgRole.OWNER && (
                                                    <Tooltip delayDuration={100}>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer"
                                                                    disabled={!hasOrgManagement}
                                                                    onClick={() => {
                                                                        setMemberToPromote(member);
                                                                        setIsPromoteDialogOpen(true);
                                                                    }}
                                                                >
                                                                    Promote to owner
                                                                </DropdownMenuItem>
                                                            </span>
                                                        </TooltipTrigger>
                                                        {!hasOrgManagement && (
                                                            <TooltipContent
                                                                side="left"
                                                                sideOffset={12}
                                                            >
                                                                Upgrade your plan to promote members to owner. <Link href={ROLES_AND_PERMISSIONS_DOCS_LINK} className="text-link hover:underline">Learn more</Link>
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                )}
                                                {currentUserRole === OrgRole.OWNER && member.role === OrgRole.OWNER && (
                                                    <Tooltip delayDuration={100}>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-destructive"
                                                                    disabled={ownerCount <= 1 || !hasOrgManagement}
                                                                    onClick={() => {
                                                                        setMemberToDemote(member);
                                                                        setIsDemoteDialogOpen(true);
                                                                    }}
                                                                >
                                                                    Demote to member
                                                                </DropdownMenuItem>
                                                            </span>
                                                        </TooltipTrigger>
                                                        {(ownerCount <= 1 || !hasOrgManagement) && (
                                                            <TooltipContent side="left" sideOffset={12}>
                                                                {!hasOrgManagement
                                                                    ? <>Upgrade your plan to demote owners. <Link href={ROLES_AND_PERMISSIONS_DOCS_LINK} className="text-link hover:underline">Learn more</Link></>
                                                                    : "Cannot demote the last owner. Promote another member to owner first."
                                                                }
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                )}
                                                {member.id !== currentUserId && currentUserRole === OrgRole.OWNER && (
                                                    <DropdownMenuItem
                                                        className="cursor-pointer text-destructive"
                                                        onClick={() => {
                                                            setMemberToRemove(member);
                                                            setIsRemoveDialogOpen(true);
                                                        }}
                                                    >
                                                        Remove
                                                    </DropdownMenuItem>
                                                )}
                                                {member.id === currentUserId && (
                                                    <Tooltip delayDuration={100}>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-destructive"
                                                                    disabled={currentUserRole === OrgRole.OWNER && ownerCount <= 1}
                                                                    onClick={() => {
                                                                        setIsLeaveOrgDialogOpen(true);
                                                                    }}
                                                                >
                                                                    Leave organization
                                                                </DropdownMenuItem>
                                                            </span>
                                                        </TooltipTrigger>
                                                        {currentUserRole === OrgRole.OWNER && ownerCount <= 1 && (
                                                            <TooltipContent side="left" sideOffset={12}>
                                                                You are the last owner. Promote another member to owner before leaving.
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <AlertDialog
                    open={isRemoveDialogOpen}
                    onOpenChange={setIsRemoveDialogOpen}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Remove Member</AlertDialogTitle>
                            <AlertDialogDescription>
                                {`Are you sure you want to remove ${memberToRemove?.name ?? memberToRemove?.email}?`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => {
                                    onRemoveMember(memberToRemove?.id ?? "");
                                }}
                            >
                                Remove
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog
                    open={isPromoteDialogOpen}
                    onOpenChange={setIsPromoteDialogOpen}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Promote to Owner</AlertDialogTitle>
                            <AlertDialogDescription>
                                {`Are you sure you want to promote ${memberToPromote?.name ?? memberToPromote?.email} to owner? They will have full administrative access.`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    onPromoteToOwner(memberToPromote?.id ?? "");
                                }}
                            >
                                Promote
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog
                    open={isDemoteDialogOpen}
                    onOpenChange={setIsDemoteDialogOpen}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Demote to Member</AlertDialogTitle>
                            <AlertDialogDescription>
                                {memberToDemote?.id === currentUserId
                                    ? `Are you sure you want to step down as owner? You will lose administrative access.`
                                    : `Are you sure you want to demote ${memberToDemote?.name ?? memberToDemote?.email} from owner to member? They will lose administrative access.`
                                }
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => {
                                    onDemoteToMember(memberToDemote?.id ?? "");
                                }}
                            >
                                Demote
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <AlertDialog
                    open={isLeaveOrgDialogOpen}
                    onOpenChange={setIsLeaveOrgDialogOpen}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Leave Organization</AlertDialogTitle>
                            <AlertDialogDescription>
                                {`Are you sure you want to leave the organization?`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={onLeaveOrg}
                            >
                                Leave
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}
