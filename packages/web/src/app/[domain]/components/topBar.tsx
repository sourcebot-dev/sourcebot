import Link from "next/link";
import Image from "next/image";
import logoLight from "@/public/sb_logo_light.png";
import logoDark from "@/public/sb_logo_dark.png";
import { SettingsDropdown } from "./settingsDropdown";
import { Separator } from "@/components/ui/separator";

interface TopBarProps {
    domain: string;
    children?: React.ReactNode;
    homePath?: string;
}

export const TopBar = ({
    domain,
    children,
    homePath = `/${domain}`,
}: TopBarProps) => {
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
                            className="h-4 w-auto hidden dark:block"
                            alt={"Sourcebot logo"}
                        />
                        <Image
                            src={logoLight}
                            className="h-4 w-auto block dark:hidden"
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