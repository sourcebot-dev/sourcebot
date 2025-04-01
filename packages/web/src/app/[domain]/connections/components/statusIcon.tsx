import { cn } from "@/lib/utils";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { useMemo } from "react";
import { FiLoader } from "react-icons/fi";

export type Status = 'waiting' | 'running' | 'succeeded' | 'succeeded-with-warnings' | 'garbage-collecting' | 'failed';

export const StatusIcon = ({
    status,
    className,
}: { status: Status, className?: string }) => {
    const Icon = useMemo(() => {
        switch (status) {
            case 'waiting':
            case 'garbage-collecting':
            case 'running':
                return <FiLoader className={cn('animate-spin-slow', className)} />;
            case 'succeeded':
                return <CircleCheckIcon className={cn('text-green-600', className)} />;
            case 'failed':
                return <CircleXIcon className={cn('text-destructive', className)} />;
            case 'succeeded-with-warnings':
            default:
                return null;
        }
    }, [className, status]);

    return Icon;
}