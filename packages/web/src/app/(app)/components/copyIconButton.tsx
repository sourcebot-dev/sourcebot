'use client';

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, Copy } from "lucide-react";
import { useCallback, useState } from "react";

interface CopyIconButtonProps {
    onCopy: () => boolean;
    className?: string;
}

export const CopyIconButton = ({ onCopy, className }: CopyIconButtonProps) => {
    const [copied, setCopied] = useState(false);

    const onClick = useCallback(() => {
        const success = onCopy();
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [onCopy]);

    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn("h-6 w-6 text-muted-foreground", className)}
            onClick={onClick}
            aria-label="Copy to clipboard"
        >
            {copied ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : (
                <Copy className="h-3 w-3" />
            )}
        </Button>
    )
}