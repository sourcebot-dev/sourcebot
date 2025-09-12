import { Button } from "@/components/ui/button";
import { NavigationMenu as NavigationMenuBase, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { SettingsDropdown } from "./settingsDropdown";
import { GitHubLogoIcon, DiscordLogoIcon } from "@radix-ui/react-icons";
import { redirect } from "next/navigation";
import { OrgSelector } from "./orgSelector";
import { ErrorNavIndicator } from "./errorNavIndicator";
import { WarningNavIndicator } from "./warningNavIndicator";
import { ProgressNavIndicator } from "./progressNavIndicator";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { TrialNavIndicator } from "./trialNavIndicator";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { env } from "@/env.mjs";
import { getSubscriptionInfo } from "@/ee/features/billing/actions";
import { auth } from "@/auth";
import WhatsNewIndicator from "./whatsNewIndicator";

const SOURCEBOT_DISCORD_URL = "https://discord.gg/6Fhp27x7Pb";
const SOURCEBOT_GITHUB_URL = "https://github.com/sourcebot-dev/sourcebot";

interface NavigationMenuProps {
    domain: string;
}

export const NavigationMenu = async ({
    domain,
}: NavigationMenuProps) => {
    const subscription = IS_BILLING_ENABLED ? await getSubscriptionInfo(domain) : null;
    const session = await auth();
    const isAuthenticated = session?.user !== undefined;

    return (
        <div className="flex flex-col w-full h-fit bg-background">
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

                    {env.SOURCEBOT_TENANCY_MODE === 'multi' && (
                        <>
                            <OrgSelector
                                domain={domain}
                            />
                            <Separator orientation="vertical" className="h-6 mx-2" />
                        </>
                    )}

                    <NavigationMenuBase>
                        <NavigationMenuList>
                            <NavigationMenuItem>
                                <NavigationMenuLink
                                    href={`/${domain}`}
                                    className={navigationMenuTriggerStyle()}
                                >
                                    Search
                                </NavigationMenuLink>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <NavigationMenuLink
                                    href={`/${domain}/repos`}
                                    className={navigationMenuTriggerStyle()}
                                >
                                    Repositories
                                </NavigationMenuLink>
                            </NavigationMenuItem>
                            {isAuthenticated && (
                                <>
                                    {env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT === undefined && (
                                        <NavigationMenuItem>
                                            <NavigationMenuLink
                                                href={`/${domain}/agents`}
                                                className={navigationMenuTriggerStyle()}
                                            >
                                                Agents
                                            </NavigationMenuLink>
                                        </NavigationMenuItem>
                                    )}
                                    <NavigationMenuItem>
                                        <NavigationMenuLink
                                            href={`/${domain}/connections`}
                                            className={navigationMenuTriggerStyle()}
                                        >
                                            Connections
                                        </NavigationMenuLink>
                                    </NavigationMenuItem>
                                    <NavigationMenuItem>
                                        <NavigationMenuLink
                                            href={`/${domain}/settings`}
                                            className={navigationMenuTriggerStyle()}
                                        >
                                            Settings
                                        </NavigationMenuLink>
                                    </NavigationMenuItem>
                                </>
                            )}
                        </NavigationMenuList>
                    </NavigationMenuBase>
                </div>

                <div className="flex flex-row items-center gap-2">
                    <ProgressNavIndicator />
                    <WarningNavIndicator />
                    <ErrorNavIndicator />
                    <TrialNavIndicator subscription={subscription} />
                    <WhatsNewIndicator />
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