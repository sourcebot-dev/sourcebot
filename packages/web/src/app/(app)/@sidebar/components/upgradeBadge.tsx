"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { OFFERINGS_DOCS_LINK } from "@/lib/constants"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import Link from "next/link"

export const UpgradeBadge = () => {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge
                    className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5 py-0 rounded-md leading-normal tracking-wide select-none"
                >
                    Pro
                </Badge>
            </TooltipTrigger>
            <TooltipPrimitive.Portal>
                <TooltipContent side="right" className="font-normal">
                    This feature requires a subscription.{" "}
                    <Link
                        href={OFFERINGS_DOCS_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline text-purple-400"
                        onClick={(e) => e.stopPropagation()}
                    >
                        Learn more
                    </Link>
                </TooltipContent>
            </TooltipPrimitive.Portal>
        </Tooltip>
    )
}