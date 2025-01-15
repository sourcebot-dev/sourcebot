import { Button } from "@/components/ui/button";
import { NavigationMenu as NavigationMenuBase, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import logoDark from "../../../public/sb_logo_dark_small.png";
import logoLight from "../../../public/sb_logo_light_small.png";
import { ProfilePicture } from "./profilePicture";
import { signOut } from "@/auth";

export const NavigationMenu = async () => {

    return (
        <div className="flex flex-col w-screen h-fit">
            <div className="flex flex-row justify-between items-center py-1.5 px-3">
                <div className="flex flex-row items-center">
                    <Link
                        href="/"
                        className="mr-3 cursor-pointer"
                    >
                        <Image
                            src={logoDark}
                            className="h-11 w-auto hidden dark:block"
                            alt={"Sourcebot logo"}
                            priority={true}
                        />
                        <Image
                            src={logoLight}
                            className="h-11 w-auto block dark:hidden"
                            alt={"Sourcebot logo"}
                            priority={true}
                        />
                    </Link>

                    <NavigationMenuBase>
                        <NavigationMenuList>
                            <NavigationMenuItem>
                                <Link href="/" legacyBehavior passHref>
                                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                                        Search
                                    </NavigationMenuLink>
                                </Link>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <Link href="/repos" legacyBehavior passHref>
                                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                                        Repositories
                                    </NavigationMenuLink>
                                </Link>
                            </NavigationMenuItem>
                        </NavigationMenuList>
                    </NavigationMenuBase>
                </div>

                <div className="flex flex-row items-center gap-2">
                    <form
                        action={async () => {
                            "use server";
                            await signOut();
                        }}
                    >
                        <Button
                            variant="outline"
                            size="default"
                        >
                            Logout
                        </Button>
                    </form>
                    <ProfilePicture />
                </div>
            </div>
            <Separator />
        </div>


    )
}