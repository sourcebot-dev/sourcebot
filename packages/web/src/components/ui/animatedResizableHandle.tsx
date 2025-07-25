'use client';

import { cn } from "@/lib/utils";
import { ResizableHandle } from "./resizable";

interface AnimatedResizableHandleProps {
    className?: string;
}

export const AnimatedResizableHandle = ({ className }: AnimatedResizableHandleProps) => {
    return (
        <ResizableHandle
            className={cn("w-[1px] bg-accent transition-colors delay-50 data-[resize-handle-state=drag]:bg-accent-foreground data-[resize-handle-state=hover]:bg-accent-foreground", className)}
        />
    )
}