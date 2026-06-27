'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { AttachmentViewerDialog } from "@/features/chat/components/chatBox/attachmentViewerDialog";
import { AttachmentData } from "@/features/chat/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface MessageAttachmentsProps {
    attachments: AttachmentData[];
    chatId: string;
    className?: string;
}

// Builds the access-controlled serving URL for a committed blob attachment.
const getAttachmentServingUrl = (chatId: string, attachmentId: string): string => {
    return `/api/ee/chat/${chatId}/attachments/${attachmentId}`;
}

export const MessageAttachments = ({ attachments, chatId, className }: MessageAttachmentsProps) => {
    const [activeAttachment, setActiveAttachment] = useState<AttachmentData | null>(null);

    if (attachments.length === 0) {
        return null;
    }

    const activeImageSrc =
        activeAttachment?.kind === 'blob' && activeAttachment.mediaType.startsWith('image/')
            ? getAttachmentServingUrl(chatId, activeAttachment.attachmentId)
            : undefined;

    return (
        <>
            <div className={cn("flex flex-row flex-wrap gap-1.5", className)}>
                {attachments.map((attachment, index) => {
                    if (attachment.kind === 'blob' && attachment.mediaType.startsWith('image/')) {
                        return (
                            <button
                                key={attachment.attachmentId}
                                type="button"
                                onClick={() => setActiveAttachment(attachment)}
                                className="h-16 w-16 rounded overflow-hidden border border-border bg-muted hover:opacity-90 transition-opacity"
                                title={`View ${attachment.filename}`}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={getAttachmentServingUrl(chatId, attachment.attachmentId)}
                                    alt={attachment.filename}
                                    className="h-full w-full object-cover"
                                />
                            </button>
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
