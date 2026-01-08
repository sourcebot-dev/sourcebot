import { TriangleAlertIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils";

const DOCS_URL = "https://docs.sourcebot.dev/docs/configuration/language-model-providers"; 

interface NotConfiguredErrorBannerProps {
    className?: string;
}

export const NotConfiguredErrorBanner = ({ className }: NotConfiguredErrorBannerProps) => {
    return (
        <div className={cn("flex flex-row items-center bg-error rounded-md p-2", className)}>
            <TriangleAlertIcon className="h-4 w-4 text-accent mr-1.5" />
            <span className="text-sm font-medium text-accent"><span className="font-bold">Ask unavailable:</span> no language model configured. See the <Link href={DOCS_URL} target="_blank" className="underline">configuration docs</Link> for more information.</span>
        </div>
    )
}