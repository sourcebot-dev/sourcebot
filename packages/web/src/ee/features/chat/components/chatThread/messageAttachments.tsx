'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { AttachmentViewerDialog } from "@/features/chat/components/chatBox/attachmentViewerDialog";
import { AttachmentData } from "@/features/chat/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface MessageAttachmentsProps {
    attachments: AttachmentData[];
    className?: string;
}

export const MessageAttachments = ({ attachments, className }: MessageAttachmentsProps) => {
    const [activeAttachment, setActiveAttachment] = useState<AttachmentData | null>(null);

    if (attachments.length === 0) {
        return null;
    }

    return (
        <>
            <div className={cn("flex flex-row flex-wrap gap-1.5", className)}>
                {attachments.map((attachment, index) => (
                    <button
                        key={`${attachment.filename}-${index}`}
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
                ))}
            </div>
            <AttachmentViewerDialog
                open={activeAttachment !== null}
                onOpenChange={(open) => !open && setActiveAttachment(null)}
                filename={activeAttachment?.filename}
                text={activeAttachment?.kind === 'text' ? activeAttachment.text : undefined}
            />
        </>
    )
}
