import logoDarkLarge from "@/public/sb_logo_dark_large.png";
import logoLightLarge from "@/public/sb_logo_light_large.png";
import logoDarkSmall from "@/public/sb_logo_dark_small.png";
import logoLightSmall from "@/public/sb_logo_light_small.png";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface SourcebotLogoProps {
    className?: string;
    size?: "small" | "large";
}

export const SourcebotLogo = ({ className, size = "large" }: SourcebotLogoProps) => {
    return (
        <>
            <Image
                src={size === "large" ? logoDarkLarge : logoDarkSmall}
                className={cn("h-16 w-auto hidden dark:block", className)}
                alt={"Sourcebot logo"}
                priority={true}
            />
            <Image
                src={size === "large" ? logoLightLarge : logoLightSmall}
                className={cn("h-16 w-auto block dark:hidden", className)}
                alt={"Sourcebot logo"}
                priority={true}
            />
        </>
    )
}