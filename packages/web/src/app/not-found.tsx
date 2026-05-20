import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

export default function NotFoundPage() {
    return (
        <div className="flex h-screen">
            <div className={cn("m-auto")}>
                <div className="flex flex-row items-center gap-2">
                    <h1 className="text-xl">404</h1>
                    <Separator
                        orientation="vertical"
                        className="h-5"
                    />
                    <p className="text-sm">Page not found</p>
                </div>
            </div>
        </div>
    )
}