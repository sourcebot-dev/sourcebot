'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AttachmentViewerDialog } from "@/features/chat/components/chatBox/attachmentViewerDialog";
import { getAttachmentPreviewUrl, releaseAttachmentPreviewUrl } from "@/features/chat/attachments/attachmentPreviewCache";
import { AttachmentData } from "@/features/chat/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// Stop probing the serving route after this many attempts rather than forever.
const SERVING_PROBE_MAX_ATTEMPTS = 15;
const SERVING_PROBE_INTERVAL_MS = 1000;

interface MessageAttachmentsProps {
    attachments: AttachmentData[];
    chatId: string;
    className?: string;
}

// Builds the access-controlled serving URL for a committed blob attachment.
const getAttachmentServingUrl = (chatId: string, attachmentId: string): string => {
    return `/api/ee/chat/${chatId}/attachments/${attachmentId}`;
}

// Prefer the local preview stashed at submit time (instant, avoids the
// pre-commit 404), falling back to the serving URL for reloaded messages.
const getBlobImageSrc = (chatId: string, attachmentId: string): string => {
    return getAttachmentPreviewUrl(attachmentId) ?? getAttachmentServingUrl(chatId, attachmentId);
}

export const MessageAttachments = ({ attachments, chatId, className }: MessageAttachmentsProps) => {
    const [activeAttachment, setActiveAttachment] = useState<AttachmentData | null>(null);
    // Bumped when a preview is released so blob `src`s recompute to the served URL.
    const [, setPreviewReleaseTick] = useState(0);

    // For any just-sent blob still backed by a local preview, probe the serving
    // route in the background; once it loads (i.e. the attachment is committed),
    // release the preview and re-render so every consumer switches to the served
    // URL atomically. Avoids revoking an object URL that's still on screen.
    useEffect(() => {
        const pendingIds = attachments
            .filter((attachment) =>
                attachment.kind === 'blob' &&
                attachment.mediaType.startsWith('image/') &&
                getAttachmentPreviewUrl(attachment.attachmentId) !== undefined)
            .map((attachment) => (attachment as Extract<AttachmentData, { kind: 'blob' }>).attachmentId);

        if (pendingIds.length === 0) {
            return;
        }

        let cancelled = false;
        const timers: ReturnType<typeof setTimeout>[] = [];

        pendingIds.forEach((attachmentId) => {
            let attempts = 0;
            const probe = () => {
                if (cancelled) {
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    if (cancelled) {
                        return;
                    }
                    releaseAttachmentPreviewUrl(attachmentId);
                    setPreviewReleaseTick((tick) => tick + 1);
                };
                img.onerror = () => {
                    if (cancelled || attempts >= SERVING_PROBE_MAX_ATTEMPTS) {
                        return;
                    }
                    attempts++;
                    timers.push(setTimeout(probe, SERVING_PROBE_INTERVAL_MS));
                };
                img.src = getAttachmentServingUrl(chatId, attachmentId);
            };
            probe();
        });

        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
    }, [attachments, chatId]);

    if (attachments.length === 0) {
        return null;
    }

    const activeImageSrc =
        activeAttachment?.kind === 'blob' && activeAttachment.mediaType.startsWith('image/')
            ? getBlobImageSrc(chatId, activeAttachment.attachmentId)
            : undefined;

    return (
        <>
            <div className={cn("flex flex-row flex-wrap gap-1.5", className)}>
                {attachments.map((attachment, index) => {
                    if (attachment.kind === 'blob' && attachment.mediaType.startsWith('image/')) {
                        const imageSrc = getBlobImageSrc(chatId, attachment.attachmentId);
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
