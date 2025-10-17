"use client";

import { NavigationMenuItem, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import { Badge } from "@/components/ui/badge";
import { cn, getShortenedNumberDisplayString } from "@/lib/utils";
import { SearchIcon, MessageCircleIcon, BookMarkedIcon, SettingsIcon, CircleIcon } from "lucide-react";
import { usePathname } from "next/navigation";

interface NavigationItemsProps {
    domain: string;
    numberOfRepos: number;
    numberOfReposWithFirstTimeIndexingJobsInProgress: number;
    isAuthenticated: boolean;
}

export const NavigationItems = ({
    domain,
    numberOfRepos,
    numberOfReposWithFirstTimeIndexingJobsInProgress,
    isAuthenticated,
}: NavigationItemsProps) => {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === `/${domain}`) {
            return pathname === `/${domain}`;
        }
        return pathname.startsWith(href);
    };

    return (
        <NavigationMenuList className="gap-2">
            <NavigationMenuItem className="relative">
                <NavigationMenuLink
                    href={`/${domain}`}
                    className={cn(navigationMenuTriggerStyle(), "gap-2")}
                >
                    <SearchIcon className="w-4 h-4 mr-1" />
                    Search
                </NavigationMenuLink>
                {isActive(`/${domain}`) && <ActiveIndicator />}
            </NavigationMenuItem>
            <NavigationMenuItem className="relative">
                <NavigationMenuLink
                    href={`/${domain}/chat`}
                    className={navigationMenuTriggerStyle()}
                >
                    <MessageCircleIcon className="w-4 h-4 mr-1" />
                    Ask
                </NavigationMenuLink>
                {isActive(`/${domain}/chat`) && <ActiveIndicator />}
            </NavigationMenuItem>
            <NavigationMenuItem className="relative">
                <NavigationMenuLink
                    href={`/${domain}/repos`}
                    className={navigationMenuTriggerStyle()}
                >
                    <BookMarkedIcon className="w-4 h-4 mr-1" />
                    <span className="mr-2">Repositories</span>
                    <Badge variant="secondary" className="px-1.5 relative">
                        {getShortenedNumberDisplayString(numberOfRepos)}
                        {numberOfReposWithFirstTimeIndexingJobsInProgress > 0 && (
                            <CircleIcon className="absolute -right-0.5 -top-0.5 h-2 w-2 text-green-600" fill="currentColor" />
                        )}
                    </Badge>
                </NavigationMenuLink>
                {isActive(`/${domain}/repos`) && <ActiveIndicator />}
            </NavigationMenuItem>
            {isAuthenticated && (
                <NavigationMenuItem className="relative">
                    <NavigationMenuLink
                        href={`/${domain}/settings`}
                        className={navigationMenuTriggerStyle()}
                    >
                        <SettingsIcon className="w-4 h-4 mr-1" />
                        Settings
                    </NavigationMenuLink>
                    {isActive(`/${domain}/settings`) && <ActiveIndicator />}
                </NavigationMenuItem>
            )}
        </NavigationMenuList>
    );
};

const ActiveIndicator = () => {
    return (
        <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-foreground" />
    );
};