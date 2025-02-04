import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import clsx from "clsx";

interface HeaderProps {
    children: React.ReactNode;
    withTopMargin?: boolean;
    className?: string;
}

export const Header = ({
    children,
    withTopMargin = true,
    className,
}: HeaderProps) => {
    return (
        <div className={cn("mb-16", className)}>
            {children}
            <Separator className={clsx("absolute left-0 right-0", { "mt-12": withTopMargin })} />
        </div>
    )
}