import Link from "next/link";
import Image from "next/image";
import logoLightSmall from "@/public/tcup_logo_small_light_color.png";
import logoDarkSmall from "@/public/tcup_logo_small_dark_mono.png";
import logoLightLarge from "@/public/tcup_logo_large_light_color.png";
import logoDarkLarge from "@/public/tcup_logo_large_dark_mono.png";
import { SettingsDropdown } from "./settingsDropdown";
import { Separator } from "@/components/ui/separator";

interface TopBarProps {
    domain: string;
    children?: React.ReactNode;
    homePath?: string;
    logoSize?: "small" | "large";
}

export const TopBar = ({
    domain,
    children,
    homePath = `/${domain}`,
    logoSize = "small",
}: TopBarProps) => {
    const logoDark = logoSize === "large" ? logoDarkLarge : logoDarkSmall;
    const logoLight = logoSize === "large" ? logoLightLarge : logoLightSmall;

    return (
        <div className='sticky top-0 left-0 right-0 z-10'>
            <div className="flex flex-row justify-between items-center py-1.5 px-3 gap-4 bg-background">
                <div className="grow flex flex-row gap-4 items-center">
                    <Link
                        href={homePath}
                        className="shrink-0 cursor-pointer"
                    >
                        <Image
                            src={logoDark}
                            className="h-8 w-auto hidden dark:block"
                            alt={"Sourcebot logo"}
                        />
                        <Image
                            src={logoLight}
                            className="h-8 w-auto block dark:hidden"
                            alt={"Sourcebot logo"}
                        />
                    </Link>
                    {children}
                </div>
                <SettingsDropdown
                    menuButtonClassName="w-8 h-8"
                />
            </div>
            <Separator />
        </div>
    )
}