'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect } from "react";

interface AttachmentViewerDialogProps {
    filename?: string;
    text?: string;
    // When set, the dialog shows the image at this URL instead of text. Used
    // for image attachments (a local object URL pre-send, the serving route
    // post-send).
    imageSrc?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Shared viewer for inspecting an attachment's contents. Used for both staged
// (not-yet-sent) and sent attachments, and for both text and image kinds.
export const AttachmentViewerDialog = ({ filename, text, imageSrc, open, onOpenChange }: AttachmentViewerDialogProps) => {
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
                {imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={imageSrc}
                        alt={filename ?? 'attachment'}
                        className="max-h-[70vh] w-auto mx-auto rounded object-contain"
                    />
                ) : (
                    <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap break-words">
                        {text}
                    </pre>
                )}
            </DialogContent>
        </Dialog>
    )
}
