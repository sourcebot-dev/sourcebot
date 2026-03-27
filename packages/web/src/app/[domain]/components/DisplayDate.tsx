import { getFormattedDate } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DisplayDateProps {
    date: Date
    className?: string
}

export const DisplayDate = ({ date, className }: DisplayDateProps) => {
    // Format date in ISO8601 (UTC) format
    const iso8601Date = date.toISOString()
    
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={className}>
                        {getFormattedDate(date)}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{iso8601Date}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}