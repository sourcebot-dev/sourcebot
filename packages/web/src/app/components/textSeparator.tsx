import { cn } from "@/lib/utils"


interface TextSeparatorProps {
    className?: string;
    text?: string;
}

export const TextSeparator = ({ className, text = "or" }: TextSeparatorProps) => {
    return (
        <div className={cn("flex items-center w-full gap-4", className)}>
            <div className="h-[1px] flex-1 bg-border" />
            <span className="text-muted-foreground text-sm">{text}</span>
            <div className="h-[1px] flex-1 bg-border" />
        </div>
    )
}