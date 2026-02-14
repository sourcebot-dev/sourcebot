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
    // Format date in ISO8601 (UTC) format for the title attribute
    const iso8601Date = date.toISOString()
    
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={className} title={iso8601Date}>
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