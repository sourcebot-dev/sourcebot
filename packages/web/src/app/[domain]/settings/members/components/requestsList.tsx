'use client';

import { OrgRole } from "@sourcebot/db";
import { useToast } from "@/components/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isServiceError } from "@/lib/utils";
import placeholderAvatar from "@/public/placeholder_avatar.png";
import { CheckCircle, MoreVertical, Search, XCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { approveAccountRequest, rejectAccountRequest } from "@/actions";
import { useRouter } from "next/navigation";
import { useDomain } from "@/hooks/useDomain";
import useCaptureEvent from "@/hooks/useCaptureEvent";

interface Request {
    id: string;
    email: string;
    createdAt: Date;
    name?: string;
}

interface RequestsListProps {
    requests: Request[]
    currentUserRole: OrgRole
}

export const RequestsList = ({ requests, currentUserRole }: RequestsListProps) => {
    const [searchQuery, setSearchQuery] = useState("")
    const [dateSort, setDateSort] = useState<"newest" | "oldest">("newest")
    const [isApproveRequestDialogOpen, setIsApproveRequestDialogOpen] = useState(false)
    const [isRejectRequestDialogOpen, setIsRejectRequestDialogOpen] = useState(false)
    const [requestToAction, setRequestToAction] = useState<Request | null>(null)
    const { toast } = useToast();
    const router = useRouter();
    const domain = useDomain();
    const captureEvent = useCaptureEvent();

    const filteredRequests = useMemo(() => {
        return requests
            .filter((request) => {
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch =
                    request.email.toLowerCase().includes(searchLower) ||
                    (request.name?.toLowerCase().includes(searchLower) || false);
                return matchesSearch;
            })
            .sort((a, b) => {
                return dateSort === "newest"
                    ? b.createdAt.getTime() - a.createdAt.getTime()
                    : a.createdAt.getTime() - b.createdAt.getTime()
            });
    }, [requests, searchQuery, dateSort]);

    const onApproveRequest = useCallback((requestId: string) => {
        approveAccountRequest(requestId, domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to approve request. Reason: ${response.message}`
                    })
                    captureEvent('wa_requests_list_approve_request_fail', {
                        error: response.errorCode,
                    })
                } else {
                    toast({
                        description: `✅ Request approved successfully.`
                    })
                    captureEvent('wa_requests_list_approve_request_success', {})
                    router.refresh();
                }
            });
    }, [domain, toast, router, captureEvent]);

    const onRejectRequest = useCallback((requestId: string) => {
        rejectAccountRequest(requestId, domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to reject request.`
                    })
                    captureEvent('wa_requests_list_reject_request_fail', {
                        error: response.errorCode,
                    })
                } else {
                    toast({
                        description: `✅ Request rejected successfully.`
                    })
                    captureEvent('wa_requests_list_reject_request_success', {})
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
                    {requests.length === 0 || (filteredRequests.length === 0 && searchQuery.length > 0) ? (
                        <div className="flex flex-col items-center justify-center h-96 p-4">
                            <p className="font-medium text-sm">No Pending Requests Found</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                {filteredRequests.length === 0 && searchQuery.length > 0 ? "No pending requests found matching your filters." : "There are currently no pending requests to join your organization."}
                            </p>
                        </div>
                    ) : (
                        filteredRequests.map((request) => (
                            <div key={request.id} className="p-4 flex items-center justify-between bg-background">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={placeholderAvatar.src} />
                                    </Avatar>
                                    <div>
                                        <div className="font-medium">{request.name || request.email}</div>
                                        <div className="text-sm text-muted-foreground">{request.email}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {currentUserRole === OrgRole.OWNER && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => {
                                                    setRequestToAction(request);
                                                    setIsApproveRequestDialogOpen(true);
                                                }}
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    setRequestToAction(request);
                                                    setIsRejectRequestDialogOpen(true);
                                                }}
                                            >
                                                <XCircle className="h-4 w-4" />
                                                Reject
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Approve Request Dialog */}
            <AlertDialog
                open={isApproveRequestDialogOpen}
                onOpenChange={setIsApproveRequestDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Request</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to approve the request from <strong>{requestToAction?.email}</strong>? They will be added as a member to your organization.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            Back
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => {
                                onApproveRequest(requestToAction?.id ?? "");
                            }}
                        >
                            Approve
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Request Dialog */}
            <AlertDialog
                open={isRejectRequestDialogOpen}
                onOpenChange={setIsRejectRequestDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject Request</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to reject the request from <strong>{requestToAction?.email}</strong>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            Back
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                onRejectRequest(requestToAction?.id ?? "");
                            }}
                        >
                            Reject
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
} 