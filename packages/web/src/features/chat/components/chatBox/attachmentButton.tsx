'use client';

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getAttachmentAcceptAttribute } from "@/features/chat/attachmentUtils";
import { Paperclip } from "lucide-react";
import { useRef } from "react";

interface AttachmentButtonProps {
    onAddFiles: (files: File[]) => void;
    acceptImages?: boolean;
    disabled?: boolean;
}

export const AttachmentButton = ({ onAddFiles, acceptImages = false, disabled }: AttachmentButtonProps) => {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={getAttachmentAcceptAttribute(acceptImages)}
                className="hidden"
                onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    if (files.length > 0) {
                        onAddFiles(files);
                    }
                    // Reset so selecting the same file again re-triggers onChange.
                    e.target.value = '';
                }}
            />
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 text-muted-foreground hover:text-foreground"
                        disabled={disabled}
                        onClick={() => inputRef.current?.click()}
                        aria-label="Attach files"
                    >
                        <Paperclip className="w-4 h-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    {acceptImages ? "Attach text files or images" : "Attach text files"}
                </TooltipContent>
            </Tooltip>
        </>
    )
}
