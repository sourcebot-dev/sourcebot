import Image from "next/image";
import { ShieldCheck } from "lucide-react";

interface ProviderIconProps {
    icon?: {
        src: string;
        className?: string;
    } | null;
    displayName: string;
    size?: "sm" | "md" | "lg";
}

const sizeClasses = {
    sm: {
        container: "h-8 w-8",
        icon: "h-4 w-4"
    },
    md: {
        container: "h-10 w-10",
        icon: "h-5 w-5"
    },
    lg: {
        container: "h-12 w-12",
        icon: "h-6 w-6"
    }
};

export function ProviderIcon({ icon, displayName, size = "md" }: ProviderIconProps) {
    const sizes = sizeClasses[size];

    if (icon) {
        return (
            <div className={`${sizes.container} rounded-md border border-border bg-background flex items-center justify-center`}>
                <Image
                    src={icon.src}
                    alt={displayName}
                    className={`${sizes.icon} ${icon.className || ''}`}
                />
            </div>
        );
    }

    return (
        <div className={`${sizes.container} rounded-lg border border-border flex items-center justify-center bg-muted`}>
            <ShieldCheck className={`${sizes.icon} text-muted-foreground`} />
        </div>
    );
}
