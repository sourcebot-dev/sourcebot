'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2, X } from "lucide-react";
import { useState } from "react";
import { PendingAttachment } from "../../attachmentUtils";
import { AttachmentViewerDialog } from "./attachmentViewerDialog";

interface AttachmentTrayProps {
    attachments: PendingAttachment[];
    // Omitted when the tray is read-only (e.g. while a submission is
    // redirecting); the remove control is hidden in that case.
    onRemove?: (id: string) => void;
    className?: string;
}

export const AttachmentTray = ({ attachments, onRemove, className }: AttachmentTrayProps) => {
    const [activeAttachment, setActiveAttachment] = useState<PendingAttachment | null>(null);

    if (attachments.length === 0) {
        return null;
    }

    return (
        <>
            <div className={cn("flex flex-row flex-wrap gap-1.5", className)}>
                {attachments.map((attachment) => (
                    attachment.kind === 'image' ? (
                        <HoverCard key={attachment.id} openDelay={150} closeDelay={75}>
                            <div className="flex flex-row items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                                <HoverCardTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => setActiveAttachment(attachment)}
                                        className="flex flex-row items-center gap-1 hover:text-foreground"
                                        title={`View ${attachment.filename}`}
                                    >
                                        <span className="relative h-3.5 w-3.5 shrink-0 overflow-hidden rounded-[2px] border border-border bg-background">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={attachment.previewUrl}
                                                alt={attachment.filename}
                                                className="h-full w-full object-cover"
                                            />
                                            {attachment.status === 'uploading' && (
                                                <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                                                    <Loader2 className="h-2.5 w-2.5 animate-spin text-foreground" />
                                                </span>
                                            )}
                                            {attachment.status === 'error' && (
                                                <span className="absolute inset-0 flex items-center justify-center bg-destructive/20">
                                                    <AlertCircle className="h-2.5 w-2.5 text-destructive" />
                                                </span>
                                            )}
                                        </span>
                                        <span className="font-mono max-w-[160px] truncate">
                                            {attachment.filename}
                                        </span>
                                    </button>
                                </HoverCardTrigger>
                                {onRemove && (
                                    <button
                                        type="button"
                                        onClick={() => onRemove(attachment.id)}
                                        className="text-muted-foreground hover:text-foreground"
                                        aria-label={`Remove ${attachment.filename}`}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <HoverCardContent className="w-auto p-1" align="start" side="top">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={attachment.previewUrl}
                                    alt={attachment.filename}
                                    className="max-h-64 max-w-[16rem] w-auto rounded object-contain"
                                />
                            </HoverCardContent>
                        </HoverCard>
                    ) : attachment.kind === 'pdf' ? (
                        // PDFs are not previewable pre-send (no chat-scoped serving
                        // URL yet), so the chip is non-interactive and just reflects
                        // the upload status.
                        <div
                            key={attachment.id}
                            className="flex flex-row items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                            title={attachment.filename}
                        >
                            {attachment.status === 'uploading' ? (
                                <Loader2 className="w-3 h-3 shrink-0 animate-spin text-muted-foreground" />
                            ) : attachment.status === 'error' ? (
                                <AlertCircle className="w-3 h-3 shrink-0 text-destructive" />
                            ) : (
                                <VscodeFileIcon fileName={attachment.filename} className="w-3 h-3" />
                            )}
                            <span className="font-mono max-w-[160px] truncate">
                                {attachment.filename}
                            </span>
                            {onRemove && (
                                <button
                                    type="button"
                                    onClick={() => onRemove(attachment.id)}
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label={`Remove ${attachment.filename}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div
                            key={attachment.id}
                            className="flex flex-row items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                        >
                            <button
                                type="button"
                                onClick={() => setActiveAttachment(attachment)}
                                className="flex flex-row items-center gap-1 hover:text-foreground"
                                title={`View ${attachment.filename}`}
                            >
                                <VscodeFileIcon fileName={attachment.filename} className="w-3 h-3" />
                                <span className="font-mono max-w-[160px] truncate">
                                    {attachment.filename}
                                </span>
                            </button>
                            {onRemove && (
                                <button
                                    type="button"
                                    onClick={() => onRemove(attachment.id)}
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label={`Remove ${attachment.filename}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )
                ))}
            </div>
            <AttachmentViewerDialog
                open={activeAttachment !== null}
                onOpenChange={(open) => !open && setActiveAttachment(null)}
                filename={activeAttachment?.filename}
                text={activeAttachment?.kind === 'text' ? activeAttachment.text : undefined}
                imageSrc={activeAttachment?.kind === 'image' ? activeAttachment.previewUrl : undefined}
            />
        </>
    )
}
