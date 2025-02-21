import { Button } from "@/components/ui/button";
import { NavigationMenu as NavigationMenuBase, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { SettingsDropdown } from "./settingsDropdown";
import { GitHubLogoIcon, DiscordLogoIcon } from "@radix-ui/react-icons";
import { redirect } from "next/navigation";
import { OrgSelector } from "./orgSelector";
import { getSubscriptionData } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { ErrorNavIndicator } from "./errorNavIndicator";
import { WarningNavIndicator } from "./warningNavIndicator";
import { ProgressNavIndicator } from "./progressNavIndicator";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";

const SOURCEBOT_DISCORD_URL = "https://discord.gg/6Fhp27x7Pb";
const SOURCEBOT_GITHUB_URL = "https://github.com/sourcebot-dev/sourcebot";

interface NavigationMenuProps {
    domain: string;
}

export const NavigationMenu = async ({
    domain,
}: NavigationMenuProps) => {
    const subscription = await getSubscriptionData(domain);

    return (
        <div className="flex flex-col w-screen h-fit">
            <div className="flex flex-row justify-between items-center py-1.5 px-3">
                <div className="flex flex-row items-center">
                    <Link
                        href={`/${domain}`}
                        className="mr-3 cursor-pointer"
                    >
                        <SourcebotLogo
                            className="h-11"
                            size="small"
                        />
                    </Link>

                    <OrgSelector
                        domain={domain}
                    />
                    <Separator orientation="vertical" className="h-6 mx-2" />

                    <NavigationMenuBase>
                        <NavigationMenuList>
                            <NavigationMenuItem>
                                <Link href={`/${domain}`} legacyBehavior passHref>
                                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                                        Search
                                    </NavigationMenuLink>
                                </Link>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <Link href={`/${domain}/repos`} legacyBehavior passHref>
                                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                                        Repositories
                                    </NavigationMenuLink>
                                </Link>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <Link href={`/${domain}/secrets`} legacyBehavior passHref>
                                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                                        Secrets
                                    </NavigationMenuLink>
                                </Link>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <Link href={`/${domain}/connections`} legacyBehavior passHref>
                                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                                        Connections
                                    </NavigationMenuLink>
                                </Link>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <Link href={`/${domain}/settings`} legacyBehavior passHref>
                                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                                        Settings
                                    </NavigationMenuLink>
                                </Link>
                            </NavigationMenuItem>
                        </NavigationMenuList>
                    </NavigationMenuBase>
                </div>

                <div className="flex flex-row items-center gap-2">
                    <ProgressNavIndicator />
                    <WarningNavIndicator />
                    <ErrorNavIndicator />
                    {!isServiceError(subscription) && subscription.status === "trialing" && (
                        <Link href={`/${domain}/settings/billing`}>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-full text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer">
                                <span className="inline-block w-2 h-2 bg-blue-400 dark:bg-blue-500 rounded-full"></span>
                                <span>
                                    {Math.ceil((subscription.nextBillingDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24))} days left in trial
                                </span>
                            </div>
                        </Link>
                    )}
                    <form
                        action={async () => {
                            "use server";
                            redirect(SOURCEBOT_DISCORD_URL);
                        }}
                    >
                        <Button
                            variant="outline"
                            size="icon"
                            type="submit"
                        >
                            <DiscordLogoIcon className="w-4 h-4" />
                        </Button>
                    </form>
                    <form
                        action={async () => {
                            "use server";
                            redirect(SOURCEBOT_GITHUB_URL);
                        }}
                    >
                        <Button
                            variant="outline"
                            size="icon"
                            type="submit"
                        >
                            <GitHubLogoIcon className="w-4 h-4" />
                        </Button>
                    </form>
                    <SettingsDropdown />
                </div>
            </div>
            <Separator />
        </div>


    )
}