import { Separator } from "@/components/ui/separator";

interface HeaderProps {
    children: React.ReactNode;
}

export const Header = ({
    children,
}: HeaderProps) => {
    return (
        <div className="mb-16">
            {children}
            <Separator className="absolute left-0 right-0 mt-6"/>
        </div>
    )
}