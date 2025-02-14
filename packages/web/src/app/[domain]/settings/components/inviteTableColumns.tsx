'use client'

import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table"
import { resolveServerPath } from "@/app/api/(client)/client";
import { createPathWithQueryParams } from "@/lib/utils";

export type InviteColumnInfo = {
    id: string;
    email: string;
    createdAt: Date;
}

export const inviteTableColumns = (displayToast: (message: string) => void): ColumnDef<InviteColumnInfo>[] => {
    return [
        {
            accessorKey: "email",
            cell: ({ row }) => {
                const invite = row.original;
                return <div>{invite.email}</div>;
            }
        },
        {
            accessorKey: "createdAt",
            cell: ({ row }) => {
                const invite = row.original;
                return invite.createdAt.toISOString();
            }
        },
        {
            id: "copy",
            cell: ({ row }) => {
                const invite = row.original;
                return (
                    <Button
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                            const basePath = `${window.location.origin}${resolveServerPath('/')}`;
                            const url = createPathWithQueryParams(`${basePath}redeem?invite_id=${invite.id}`);
                            navigator.clipboard.writeText(url)
                                .then(() => {
                                    displayToast("✅ Copied invite link");
                                })
                                .catch(() => {
                                    displayToast("❌ Failed to copy invite link");
                                })
                        }}
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
                            className="hover:stroke-gray-600 transition-colors"
                        >
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                    </Button>
                )
            }
        }
    ]
}