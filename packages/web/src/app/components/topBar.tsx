import Link from "next/link";
import Image from "next/image";
import logoLight from "@/public/sb_logo_light.png";
import logoDark from "@/public/sb_logo_dark.png";
import { SearchBar } from "./searchBar";
import { SettingsDropdown } from "./settingsDropdown";

interface TopBarProps {
    defaultSearchQuery?: string;
}

export const TopBar = ({
    defaultSearchQuery
}: TopBarProps) => {
    return (
        <div className="flex flex-row justify-between items-center py-1.5 px-3 gap-4 bg-background">
            <div className="grow flex flex-row gap-4 items-center">
                <Link
                    href="/"
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
                <SearchBar
                    size="sm"
                    defaultQuery={defaultSearchQuery}
                    className="w-full"
                />
            </div>
            <SettingsDropdown
                menuButtonClassName="w-8 h-8"
            />
        </div>
    )
}