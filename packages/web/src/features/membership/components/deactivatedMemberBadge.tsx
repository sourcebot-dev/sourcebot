import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

/**
 * Marks a member whose membership has been deactivated (`isActive = false`, e.g.
 * via SCIM). They keep their membership row but can no longer access the org.
 */
export const DeactivatedMemberBadge = () => (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge variant="outline" className="font-normal cursor-help gap-1 shrink-0 whitespace-nowrap">
                    Deactivated
                    <Info className="h-3 w-3" />
                </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
                This member has been deactivated and can no longer access the organization.
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);
