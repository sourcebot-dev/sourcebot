import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface BackButtonProps {
    href: string;
    name: string;
    className?: string;
}

export function BackButton({ href, name, className }: BackButtonProps) {
    return (
        <Link href={href} className={cn("inline-flex items-center text-link transition-colors group", className)}>
            <span className="inline-flex items-center gap-1.5 border-b border-transparent group-hover:border-link pb-0.5">
                <ArrowLeft className="h-4 w-4" />
                <span>{name}</span>
            </span>
        </Link>
    )
}
