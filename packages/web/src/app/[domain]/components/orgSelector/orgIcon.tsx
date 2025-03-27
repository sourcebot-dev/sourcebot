import { cn } from "@/lib/utils";
import placeholderAvatar from "@/public/placeholder_avatar.png";
import { cva } from "class-variance-authority";
import Image from "next/image";

interface OrgIconProps {
    className?: string;
    size?: "default";
}

const iconVariants = cva(
    "rounded-full",
    {
        variants: {
            size: {
                default: "w-5 h-5"
            }
        },
        defaultVariants: {
            size: "default"
        }
    },
)

export const OrgIcon = ({
    className,
    size,
}: OrgIconProps) => {
    return (
        <Image
            src={placeholderAvatar}
            alt="Organization avatar"
            className={cn(iconVariants({ size, className }))}
        />
    )
}