'use client';

import { Input } from "@/components/ui/input";
import { Search, MoreVertical } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCallback, useMemo, useState } from "react";
import { OrgRole } from "@prisma/client";
import placeholderAvatar from "@/public/placeholder_avatar.png";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDomain } from "@/hooks/useDomain";
import { transferOwnership, removeMemberFromOrg, leaveOrg } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";

type Member = {
    id: string
    email: string
    name?: string
    role: OrgRole
    joinedAt: Date
    avatarUrl?: string
}

interface MembersListProps {
    members: Member[],
    currentUserId: string,
    currentUserRole: OrgRole,
    orgName: string,
}

export const MembersList = ({ members, currentUserId, currentUserRole, orgName }: MembersListProps) => {
    const [searchQuery, setSearchQuery] = useState("")
    const [roleFilter, setRoleFilter] = useState<"all" | OrgRole>("all")
    const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest")
    const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)
    const [memberToTransfer, setMemberToTransfer] = useState<Member | null>(null)
    const domain = useDomain()
    const { toast } = useToast()
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
    const [isTransferOwnershipDialogOpen, setIsTransferOwnershipDialogOpen] = useState(false)
    const [isLeaveOrgDialogOpen, setIsLeaveOrgDialogOpen] = useState(false)
    const router = useRouter();

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
        removeMemberFromOrg(memberId, domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to remove member. Reason: ${response.message}`
                    })
                } else {
                    toast({
                        description: `✅ Member removed successfully.`
                    })
                    router.refresh();
                }
            });
    }, [domain, toast, router]);

    const onTransferOwnership = useCallback((memberId: string) => {
        transferOwnership(memberId, domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to transfer ownership. Reason: ${response.message}`
                    })
                } else {
                    toast({
                        description: `✅ Ownership transferred successfully.`
                    })
                    router.refresh();
                }
            });
    }, [domain, toast, router]);

    const onLeaveOrg = useCallback(() => {
        leaveOrg(domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to leave organization. Reason: ${response.message}`
                    })
                } else {
                    toast({
                        description: `✅ You have left the organization.`
                    })
                    router.push("/");
                }
            });
    }, [domain, toast, router]);

    return (
        <div>
            <div className="w-full mx-auto space-y-6">
                <h2 className="text-lg font-semibold border-b pb-2">Team Members</h2>

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

                <div className="border rounded-lg divide-y">
                    {filteredMembers.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">No members found matching your filters</div>
                    ) : (
                        filteredMembers.map((member) => (
                            <div key={member.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={member.avatarUrl ?? placeholderAvatar.src} />
                                    </Avatar>
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
                                                    navigator.clipboard.writeText(member.email);
                                                    toast({
                                                        description: `✅ Email copied to clipboard.`
                                                    })
                                                }}
                                            >
                                                Copy email
                                            </DropdownMenuItem>
                                            {member.id !== currentUserId && currentUserRole === OrgRole.OWNER && (
                                                <DropdownMenuItem
                                                    className="cursor-pointer"
                                                    onClick={() => {
                                                        setMemberToTransfer(member);
                                                        setIsTransferOwnershipDialogOpen(true);
                                                    }}
                                                >
                                                    Transfer ownership
                                                </DropdownMenuItem>
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
                                                <DropdownMenuItem
                                                    className="cursor-pointer text-destructive"
                                                    disabled={currentUserRole === OrgRole.OWNER}
                                                    onClick={() => {
                                                        setIsLeaveOrgDialogOpen(true);
                                                    }}
                                                >
                                                    Leave organization
                                                </DropdownMenuItem>
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
                            {`Are you sure you want to remove ${memberToRemove?.name ?? memberToRemove?.email}? Your subscription's seat count will be automatically adjusted.`}
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
                open={isTransferOwnershipDialogOpen}
                onOpenChange={setIsTransferOwnershipDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
                        <AlertDialogDescription>
                            {`Are you sure you want to transfer ownership of ${orgName} to ${memberToTransfer?.name ?? memberToTransfer?.email}?`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                onTransferOwnership(memberToTransfer?.id ?? "");
                            }}
                        >
                            Transfer
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
                            {`Are you sure you want to leave ${orgName}?`}
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
    )
}

