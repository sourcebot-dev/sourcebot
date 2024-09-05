'use client';

import Image from "next/image";
import logoDark from "../../public/sb_logo_dark_large.png";
import logoLight from "../../public/sb_logo_light_large.png";
import { SearchBar } from "./searchBar";
import { SettingsDropdown } from "./settingsDropdown";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";

const SOURCEBOT_GITHUB_URL = "https://github.com/TaqlaAI/sourcebot";

export default function Home() {

    return (
        <div className="h-screen flex flex-col items-center">
            {/* TopBar */}
            <div className="absolute top-0 left-0 right-0">
                <div className="flex flex-row justify-end items-center py-1.5 px-3 gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                            window.open(SOURCEBOT_GITHUB_URL, "_blank");
                        }}
                    >
                        <GitHubLogoIcon className="w-4 h-4" />
                    </Button>
                    <SettingsDropdown />
                </div>
            </div>
            <div className="flex flex-col justify-center items-center p-4 mt-48">
                <div className="max-h-44 w-auto">
                    <Image
                        src={logoDark}
                        className="w-full h-full hidden dark:block"
                        alt={"Sourcebot logo"}
                    />
                    <Image
                        src={logoLight}
                        className="w-full h-full block dark:hidden"
                        alt={"Sourcebot logo"}
                    />
                </div>
                <div className="w-full flex flex-row mt-4">
                    <SearchBar
                        autoFocus={true}
                    />
                </div>
            </div>
        </div>
    )
}
