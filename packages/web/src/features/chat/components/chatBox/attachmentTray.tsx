'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useState } from "react";
import { PendingAttachment } from "../../attachmentUtils";
import { AttachmentViewerDialog } from "./attachmentViewerDialog";

interface AttachmentTrayProps {
    attachments: PendingAttachment[];
    onRemove: (id: string) => void;
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
                        <button
                            type="button"
                            onClick={() => onRemove(attachment.id)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Remove ${attachment.filename}`}
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>
            <AttachmentViewerDialog
                open={activeAttachment !== null}
                onOpenChange={(open) => !open && setActiveAttachment(null)}
                filename={activeAttachment?.filename}
                text={activeAttachment?.text}
            />
        </>
    )
}
