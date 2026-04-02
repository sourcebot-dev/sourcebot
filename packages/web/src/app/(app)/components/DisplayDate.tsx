import { getFormattedDate } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const formatFullDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
    }).format(date)
}

interface DisplayDateProps {
    date: Date
    className?: string
}

export const DisplayDate = ({ date, className }: DisplayDateProps) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={className}>
                        {getFormattedDate(date)}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{formatFullDate(date)}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}