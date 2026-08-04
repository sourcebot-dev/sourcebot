'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AttachmentViewerDialog } from "@/features/chat/components/chatBox/attachmentViewerDialog";
import { mediaTypeToModality } from "@/features/chat/attachments/modality";
import { AttachmentData } from "@/features/chat/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface MessageAttachmentsProps {
    attachments: AttachmentData[];
    chatId: string;
    className?: string;
}

// Builds the access-controlled serving URL for a blob attachment. The uploader
// can fetch their own bytes from this route immediately after sending (even
// before the commit links the blob to the chat), so a just-sent image renders
// here directly.
const getAttachmentServingUrl = (chatId: string, attachmentId: string): string => {
    return `/api/ee/chat/${chatId}/attachments/${attachmentId}`;
}

export const MessageAttachments = ({ attachments, chatId, className }: MessageAttachmentsProps) => {
    const [activeAttachment, setActiveAttachment] = useState<AttachmentData | null>(null);

    if (attachments.length === 0) {
        return null;
    }

    const activeImageSrc =
        activeAttachment?.kind === 'blob' && mediaTypeToModality(activeAttachment.mediaType) === 'image'
            ? getAttachmentServingUrl(chatId, activeAttachment.attachmentId)
            : undefined;

    return (
        <>
            <div className={cn("flex flex-row flex-wrap gap-1.5", className)}>
                {attachments.map((attachment, index) => {
                    if (attachment.kind === 'blob' && mediaTypeToModality(attachment.mediaType) === 'image') {
                        const imageSrc = getAttachmentServingUrl(chatId, attachment.attachmentId);
                        return (
                            <HoverCard key={attachment.attachmentId} openDelay={150} closeDelay={75}>
                                <HoverCardTrigger asChild>
                                    <button
                                        type="button"
                                        onClick={() => setActiveAttachment(attachment)}
                                        className="flex flex-row items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs hover:bg-accent transition-colors"
                                        title={`View ${attachment.filename}`}
                                    >
                                        <span className="h-3.5 w-3.5 shrink-0 overflow-hidden rounded-[2px] border border-border bg-background">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={imageSrc}
                                                alt={attachment.filename}
                                                className="h-full w-full object-cover"
                                            />
                                        </span>
                                        <span className="font-mono max-w-[160px] truncate">
                                            {attachment.filename}
                                        </span>
                                    </button>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-auto p-1" align="start" side="top">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={imageSrc}
                                        alt={attachment.filename}
                                        className="max-h-64 max-w-[16rem] w-auto rounded object-contain"
                                    />
                                </HoverCardContent>
                            </HoverCard>
                        );
                    }

                    return (
                        <button
                            key={attachment.kind === 'blob' ? attachment.attachmentId : `${attachment.filename}-${index}`}
                            type="button"
                            onClick={() => setActiveAttachment(attachment)}
                            className="flex flex-row items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs hover:bg-accent transition-colors"
                            title={`View ${attachment.filename}`}
                        >
                            <VscodeFileIcon fileName={attachment.filename} className="w-3 h-3" />
                            <span className="font-mono max-w-[160px] truncate">
                                {attachment.filename}
                            </span>
                        </button>
                    );
                })}
            </div>
            <AttachmentViewerDialog
                open={activeAttachment !== null}
                onOpenChange={(open) => !open && setActiveAttachment(null)}
                filename={activeAttachment?.filename}
                text={activeAttachment?.kind === 'text' ? activeAttachment.text : undefined}
                imageSrc={activeImageSrc}
            />
        </>
    )
}
