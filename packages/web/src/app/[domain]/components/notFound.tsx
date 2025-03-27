import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface NotFoundProps {
    message: string;
    className?: string;
}

export const NotFound = ({
    message,
    className,
}: NotFoundProps) => {
    return (
        <div className={cn("m-auto", className)}>
            <div className="flex flex-row items-center gap-2">
                <h1 className="text-xl">404</h1>
                <Separator
                    orientation="vertical"
                    className="h-5"
                />
                <p className="text-sm">{message}</p>
            </div>
        </div>
    )
}