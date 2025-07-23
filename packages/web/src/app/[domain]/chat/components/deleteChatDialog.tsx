'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCallback } from "react";

interface DeleteChatDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete: () => void;
}

export const DeleteChatDialog = ({ isOpen, onOpenChange, onDelete }: DeleteChatDialogProps) => {
    const handleDelete = useCallback(() => {
        onDelete();
        onOpenChange(false);
    }, [onDelete, onOpenChange]);

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onOpenChange}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete chat?</DialogTitle>
                    <DialogDescription>
                        The chat will be deleted and removed from your chat history. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenChange(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                    >
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

