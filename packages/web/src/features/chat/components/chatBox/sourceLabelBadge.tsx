import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SourceLabelBadgeProps {
    children: ReactNode;
    className?: string;
}

export const SourceLabelBadge = ({ children, className }: SourceLabelBadgeProps) => (
    <span className={cn(
        "shrink-0 rounded border border-border px-1 py-px font-sans text-[10px] leading-none text-muted-foreground",
        className,
    )}>
        {children}
    </span>
);
