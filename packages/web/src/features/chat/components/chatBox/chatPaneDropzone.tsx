'use client';

import { useToast } from "@/components/hooks/use-toast";
import { getAttachmentDropzoneAccept } from "@/features/chat/attachmentUtils";
import { cn } from "@/lib/utils";
import { FileUp } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

interface ChatPaneDropzoneProps {
    onFilesDropped: (files: File[]) => void;
    disabled?: boolean;
    className?: string;
    children: ReactNode;
}

// Makes an entire chat pane a drag-and-drop target for attachments. Drops are
// forwarded to the chat box (which owns attachment state) via `onFilesDropped`.
// `noClick`/`noKeyboard` keep the zone from hijacking clicks/keys; the file
// picker is opened separately from the attachment button.
export const ChatPaneDropzone = ({ onFilesDropped, disabled, className, children }: ChatPaneDropzoneProps) => {
    const { toast } = useToast();
    // Only surface the overlay when actual files are being dragged (not, e.g., a
    // text selection dragged within the editor). `dragFileCount` is the number of
    // files in the active drag (when the browser exposes it).
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    const [dragFileCount, setDragFileCount] = useState(0);

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        // Accept images at the dropzone layer regardless of model capability;
        // the chat box's add handler applies the authoritative image gate (and
        // surfaces a precise message when the selected model is text-only).
        accept: getAttachmentDropzoneAccept(true),
        multiple: true,
        noClick: true,
        noKeyboard: true,
        disabled,
        onDrop: (acceptedFiles, fileRejections) => {
            setIsDraggingFiles(false);
            if (acceptedFiles.length > 0) {
                onFilesDropped(acceptedFiles);
            }
            if (fileRejections.length > 0) {
                toast({
                    description: `⚠️ Unsupported file type: ${fileRejections.map((rejection) => rejection.file.name).join(', ')}.`,
                    variant: "destructive",
                });
            }
        },
    });

    // react-dropzone clears `isDragActive` when the drag leaves; mirror that for
    // our files flag so the overlay never gets stuck.
    useEffect(() => {
        if (!isDragActive) {
            setIsDraggingFiles(false);
            setDragFileCount(0);
        }
    }, [isDragActive]);

    const showOverlay = isDragActive && isDraggingFiles && !disabled;

    return (
        <div
            {...getRootProps({
                className: cn("relative", className),
                onDragEnter: (event) => {
                    const types = event.dataTransfer?.types ?? [];
                    setIsDraggingFiles(types.includes('Files'));
                    const items = event.dataTransfer?.items;
                    setDragFileCount(items ? Array.from(items).filter((item) => item.kind === 'file').length : 0);
                },
            })}
        >
            <input {...getInputProps()} />
            {showOverlay && (
                <div className="absolute inset-0 z-30 flex items-center justify-center rounded-md bg-background/70 backdrop-blur-sm pointer-events-none animate-in fade-in-0 duration-150">
                    <div
                        className={cn(
                            "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-8 py-6 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150",
                            isDragReject ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5",
                        )}
                    >
                        <FileUp className={cn("w-8 h-8", isDragReject ? "text-destructive" : "text-primary")} />
                        <span className="text-lg font-medium text-foreground">
                            {isDragReject ? "Unsupported file type" : "Drop to attach"}
                        </span>
                        {dragFileCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                                {dragFileCount} file{dragFileCount === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>
                </div>
            )}
            {children}
        </div>
    )
}
