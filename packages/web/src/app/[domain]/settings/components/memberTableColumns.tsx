'use client'

import { Button } from "@/components/ui/button"
import { ColumnDef } from "@tanstack/react-table"
import {
    Dialog,
    DialogContent,
    DialogClose,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { removeMember } from "@/actions"
import { useToast } from "@/components/hooks/use-toast"
import { useDomain } from "@/hooks/useDomain";
import { isServiceError } from "@/lib/utils";
import { useRouter } from "next/navigation";

export type MemberColumnInfo = {
    id: string;
    name: string;
    email: string;
    role: string;
}

export const MemberTableColumns = (currentUserId: string): ColumnDef<MemberColumnInfo>[] => {
    const { toast } = useToast();
    const domain = useDomain();
    const router = useRouter();
    return [
        {
            accessorKey: "name",
            cell: ({ row }) => {
                const member = row.original;
                return <div>{member.name}</div>;
            }
        },
        {
            accessorKey: "email",
            cell: ({ row }) => {
                const member = row.original;
                return <div>{member.email}</div>;
            }
        },
        {
            accessorKey: "role",
            cell: ({ row }) => {
                const member = row.original;
                return <div>{member.role}</div>;
            }
        },
        {
            id: "remove",
            cell: ({ row }) => {
                const member = row.original;
                if (member.id === currentUserId) {
                    return null;
                }
                return (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-destructive/30 transition-colors"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-destructive hover:text-destructive transition-colors"
                                >
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-semibold">Remove Member</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-4">
                                    <p className="font-medium">Are you sure you want to remove this member?</p>
                                    <div className="rounded-lg bg-muted p-4">
                                        <p className="text-sm text-muted-foreground">
                                            This action will remove <span className="font-semibold text-foreground">{member.email}</span> from your organization.
                                            <br/>
                                            <br/>
                                            Your subscription&apos;s seat count will be automatically adjusted.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button variant="outline">Cancel</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                    <Button 
                                        variant="destructive" 
                                        className="hover:bg-destructive/90"
                                        onClick={async () => {
                                            const response = await removeMember(member.id, domain);
                                            if (isServiceError(response)) {
                                                toast({
                                                    description: `❌ Failed to remove member. Reason: ${response.message}`
                                                });
                                            } else {
                                                toast({
                                                    description: `✅ Member removed successfully.`
                                                });

                                                router.refresh();
                                            }
                                        }}
                                    >
                                        Remove Member
                                    </Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                );
            }
        }
    ]
}