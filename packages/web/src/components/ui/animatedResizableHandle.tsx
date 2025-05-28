'use client';

import { ResizableHandle } from "./resizable";

export const AnimatedResizableHandle = () => {
    return (
        <ResizableHandle
            className="w-[1px] bg-accent transition-colors delay-50 data-[resize-handle-state=drag]:bg-accent-foreground data-[resize-handle-state=hover]:bg-accent-foreground"
        />
    )
}