import logoDarkLarge from "@/public/tcup_logo_large_dark_mono.png";
import logoLightLarge from "@/public/tcup_logo_large_light_color.png";
import logoDarkSmall from "@/public/tcup_logo_small_dark_mono.png";
import logoLightSmall from "@/public/tcup_logo_small_light_color.png";
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