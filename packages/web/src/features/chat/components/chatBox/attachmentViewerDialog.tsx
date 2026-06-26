'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AttachmentViewerDialogProps {
    filename?: string;
    text?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Shared viewer for inspecting an inline-text attachment's contents. Used for
// both staged (not-yet-sent) and sent attachments.
export const AttachmentViewerDialog = ({ filename, text, open, onOpenChange }: AttachmentViewerDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="font-mono text-sm break-all">
                        {filename}
                    </DialogTitle>
                </DialogHeader>
                <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-words">
                    {text}
                </pre>
            </DialogContent>
        </Dialog>
    )
}
