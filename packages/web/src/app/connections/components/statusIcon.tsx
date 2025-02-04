import { cn } from "@/lib/utils";
import { Cross2Icon } from "@radix-ui/react-icons";
import { CircleCheckIcon } from "lucide-react";
import { useMemo } from "react";
import { FiLoader } from "react-icons/fi";

export type Status = 'waiting' | 'running' | 'succeeded' | 'failed';

export const StatusIcon = ({
    status,
    className,
}: { status: Status, className?: string }) => {
    const Icon = useMemo(() => {
        switch (status) {
            case 'waiting':
            case 'running':
                return <FiLoader className={cn('animate-spin-slow', className)} />;
            case 'succeeded':
                return <CircleCheckIcon className={cn('text-green-600', className)} />;
            case 'failed':
                return <Cross2Icon className={cn(className)} />;

        }
    }, [className, status]);

    return Icon;
}