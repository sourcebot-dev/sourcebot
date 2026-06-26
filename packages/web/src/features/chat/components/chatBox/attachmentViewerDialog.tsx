'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect } from "react";

interface AttachmentViewerDialogProps {
    filename?: string;
    text?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Shared viewer for inspecting an inline-text attachment's contents. Used for
// both staged (not-yet-sent) and sent attachments.
export const AttachmentViewerDialog = ({ filename, text, open, onOpenChange }: AttachmentViewerDialogProps) => {
    // The staged viewer is rendered inside the Slate `Editable` subtree, where
    // Radix's built-in Escape-to-close can get swallowed by the editor's
    // focus/key handling. A capture-phase listener guarantees Escape closes the
    // dialog, matching every other modal in the app.
    useEffect(() => {
        if (!open) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onOpenChange(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [open, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="font-mono text-sm break-all">
                        {filename}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Preview of the attached file{filename ? ` ${filename}` : ''}.
                    </DialogDescription>
                </DialogHeader>
                <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-words">
                    {text}
                </pre>
            </DialogContent>
        </Dialog>
    )
}
