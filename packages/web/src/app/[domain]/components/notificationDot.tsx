import { cn } from "@/lib/utils"

interface NotificationDotProps {
    className?: string
}

export const NotificationDot = ({ className }: NotificationDotProps) => {
    return <div className={cn("w-2 h-2 rounded-full bg-green-600", className)} />
}