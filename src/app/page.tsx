'use client';

import Image from "next/image";
import logoDark from "../../public/sb_logo_dark_large.png";
import logoLight from "../../public/sb_logo_light_large.png";
import { NavigationMenu } from "./navigationMenu";
import { SearchBar } from "./searchBar";

export default function Home() {
    return (
        <div className="h-screen flex flex-col items-center">
            {/* TopBar */}
            <NavigationMenu />
            
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
