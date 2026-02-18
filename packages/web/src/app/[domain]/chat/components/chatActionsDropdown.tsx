'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CopyIcon, PencilIcon, TrashIcon } from "lucide-react";

interface ChatActionsDropdownProps {
    children: React.ReactNode;
    onRenameClick: () => void;
    onDuplicateClick: () => void;
    onDeleteClick: () => void;
    showDelete?: boolean;
    align?: "start" | "center" | "end";
}

export const ChatActionsDropdown = ({
    children,
    onRenameClick,
    onDuplicateClick,
    onDeleteClick,
    showDelete = true,
    align = "start",
}: ChatActionsDropdownProps) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {children}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align={align}
                className="z-20"
            >
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRenameClick();
                    }}
                >
                    <PencilIcon className="w-4 h-4 mr-2" />
                    Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateClick();
                    }}
                >
                    <CopyIcon className="w-4 h-4 mr-2" />
                    Duplicate
                </DropdownMenuItem>
                {showDelete && (
                    <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClick();
                        }}
                    >
                        <TrashIcon className="w-4 h-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
