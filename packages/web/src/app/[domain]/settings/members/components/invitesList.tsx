'use client';

import { OrgRole } from "@sourcebot/db";
import { useToast } from "@/components/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPathWithQueryParams, isServiceError } from "@/lib/utils";
import placeholderAvatar from "@/public/placeholder_avatar.png";
import { Copy, MoreVertical, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { cancelInvite } from "@/actions";
import { useRouter } from "next/navigation";
import { useDomain } from "@/hooks/useDomain";
import useCaptureEvent from "@/hooks/useCaptureEvent";
interface Invite {
    id: string;
    email: string;
    createdAt: Date;
}

interface InviteListProps {
    invites: Invite[]
    currentUserRole: OrgRole
}

export const InvitesList = ({ invites, currentUserRole }: InviteListProps) => {
    const [searchQuery, setSearchQuery] = useState("")
    const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest")
    const [isCancelInviteDialogOpen, setIsCancelInviteDialogOpen] = useState(false)
    const [inviteToCancel, setInviteToCancel] = useState<Invite | null>(null)
    const { toast } = useToast();
    const router = useRouter();
    const domain = useDomain();
    const captureEvent = useCaptureEvent();

    const filteredInvites = useMemo(() => {
        return invites
            .filter((invite) => {
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch =
                    invite.email.toLowerCase().includes(searchLower);
                return matchesSearch;
            })
            .sort((a, b) => {
                return dateSort === "newest"
                    ? b.createdAt.getTime() - a.createdAt.getTime()
                    : a.createdAt.getTime() - b.createdAt.getTime()
            });
    }, [invites, searchQuery, dateSort]);

    const onCancelInvite = useCallback((inviteId: string) => {
        cancelInvite(inviteId, domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to cancel invite. Reason: ${response.message}`
                    })
                    captureEvent('wa_invites_list_cancel_invite_fail', {
                        error: response.errorCode,
                    })
                } else {
                    toast({
                        description: `✅ Invite cancelled successfully.`
                    })
                    captureEvent('wa_invites_list_cancel_invite_success', {})
                    router.refresh();
                }
            });
    }, [domain, toast, router, captureEvent]);

    return (
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
                    {invites.length === 0 || (filteredInvites.length === 0 && searchQuery.length > 0) ? (
                        <div className="flex flex-col items-center justify-center h-96 p-4">
                            <p className="font-medium text-sm">No Pending Invitations Found</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                {filteredInvites.length === 0 && searchQuery.length > 0 ? "No pending invitations found matching your filters." : "Use the form above to invite new members."}
                            </p>
                        </div>
                    ) : (
                        filteredInvites.map((invite) => (
                            <div key={invite.id} className="p-4 flex items-center justify-between bg-background">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={placeholderAvatar.src} />
                                    </Avatar>
                                    <div>
                                        <div className="text-sm text-muted-foreground">{invite.email}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="gap-2"
                                        title="Copy invite link"
                                        onClick={() => {
                                            const url = createPathWithQueryParams(`${window.location.origin}/redeem?invite_id=${invite.id}`);
                                            navigator.clipboard.writeText(url)
                                                .then(() => {
                                                    toast({
                                                        description: `✅ Copied invite link for ${invite.email} to clipboard`
                                                    })
                                                    captureEvent('wa_invites_list_copy_invite_link_success', {})
                                                })
                                                .catch(() => {
                                                    toast({
                                                        description: "❌ Failed to copy invite link"
                                                    })
                                                    captureEvent('wa_invites_list_copy_invite_link_fail', {})
                                                })
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                        Copy invite link
                                    </Button>
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
                                                    navigator.clipboard.writeText(invite.email)
                                                        .then(() => {
                                                            toast({
                                                                description: `✅ Email copied to clipboard.`
                                                            })
                                                            captureEvent('wa_invites_list_copy_email_success', {})
                                                        })
                                                        .catch(() => {
                                                            toast({
                                                                description: `❌ Failed to copy email.`
                                                            })
                                                            captureEvent('wa_invites_list_copy_email_fail', {})
                                                        })
                                                }}
                                            >
                                                Copy email
                                            </DropdownMenuItem>
                                            {currentUserRole === OrgRole.OWNER && (
                                                <DropdownMenuItem
                                                    className="cursor-pointer text-destructive"
                                                    onClick={() => {
                                                        setIsCancelInviteDialogOpen(true);
                                                        setInviteToCancel(invite);
                                                    }}
                                                >
                                                    Cancel invite
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
                open={isCancelInviteDialogOpen}
                onOpenChange={setIsCancelInviteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Invite</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to cancel this invite for <strong>{inviteToCancel?.email}</strong>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            Back
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                onCancelInvite(inviteToCancel?.id ?? "");
                            }}
                        >
                            Cancel
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}