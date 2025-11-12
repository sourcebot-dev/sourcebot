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
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { removeMemberFromOrg } from "@/features/members/actions";

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
}

export const MembersList = ({ members, currentUserId, currentUserRole }: MembersListProps) => {
    const [searchQuery, setSearchQuery] = useState("")
    const [roleFilter, setRoleFilter] = useState<"all" | OrgRole>("all")
    const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest")
    const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)
    const [roleChangeData, setRoleChangeData] = useState<{ member: Member; newRole: OrgRole } | null>(null)
    const domain = useDomain()
    const { toast } = useToast()
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
    const [isRoleChangeDialogOpen, setIsRoleChangeDialogOpen] = useState(false)
    const router = useRouter();
    const captureEvent = useCaptureEvent();

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
                    captureEvent('wa_members_list_remove_member_fail', {
                        error: response.errorCode,
                    })
                } else {
                    toast({
                        description: `✅ Member removed successfully.`
                    })
                    captureEvent('wa_members_list_remove_member_success', {})
                    router.refresh();
                }
            });
    }, [domain, toast, router, captureEvent]);

    const onChangeMembership = useCallback((_memberId: string, _newRole: OrgRole) => {
        // @todo
    }, []);

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
                                        <Avatar>
                                            <AvatarImage src={member.avatarUrl ?? placeholderAvatar.src} />
                                        </Avatar>
                                        <div>
                                            <div className="font-medium">{member.name}</div>
                                            <div className="text-sm text-muted-foreground">{member.email}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Select 
                                            value={member.role} 
                                            onValueChange={(value) => {
                                                const newRole = value as OrgRole;
                                                if (newRole !== member.role) {
                                                    setRoleChangeData({ member, newRole });
                                                    setIsRoleChangeDialogOpen(true);
                                                }
                                            }}
                                            disabled={member.id === currentUserId || currentUserRole !== OrgRole.OWNER}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder={member.role.toLowerCase()} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={OrgRole.OWNER}>Owner</SelectItem>
                                                <SelectItem value={OrgRole.MEMBER}>Member</SelectItem>
                                            </SelectContent>
                                        </Select>
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
                    open={isRoleChangeDialogOpen}
                    onOpenChange={setIsRoleChangeDialogOpen}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Change Member Role</AlertDialogTitle>
                            <AlertDialogDescription>
                                {roleChangeData && `Are you sure you want to change ${roleChangeData.member.name ?? roleChangeData.member.email}'s role to ${roleChangeData.newRole.toLowerCase()}?`}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    if (roleChangeData) {
                                        onChangeMembership(roleChangeData.member.id, roleChangeData.newRole);
                                    }
                                }}
                            >
                                Confirm
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}

