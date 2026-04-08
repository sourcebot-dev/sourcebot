"use client";

import { NavigationMenuItem, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import { Badge } from "@/components/ui/badge";
import { cn, getShortenedNumberDisplayString } from "@/lib/utils";
import { SearchIcon, MessageCircleIcon, BookMarkedIcon, SettingsIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { NotificationDot } from "../notificationDot";

interface NavigationItemsProps {
    numberOfRepos: number;
    isReposButtonNotificationDotVisible: boolean;
    isSettingsButtonNotificationDotVisible: boolean;
    isAuthenticated: boolean;
}

export const NavigationItems = ({
    numberOfRepos,
    isReposButtonNotificationDotVisible,
    isSettingsButtonNotificationDotVisible,
    isAuthenticated,
}: NavigationItemsProps) => {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === '/') {
            return pathname === '/';
        }
        if (href === '/repos') {
            return (
                pathname === '/repos' ||
                pathname.startsWith('/repos/') ||
                pathname === '/browse' ||
                pathname.startsWith('/browse/')
            );
        }
        return pathname.startsWith(href);
    };

    return (
        <NavigationMenuList className="gap-2">
            <NavigationMenuItem className="relative">
                <NavigationMenuLink
                    href="/search"
                    className={cn(navigationMenuTriggerStyle(), "gap-2")}
                >
                    <SearchIcon className="w-4 h-4 mr-1" />
                    Search
                </NavigationMenuLink>
                {((isActive('/') || isActive('/search')) && <ActiveIndicator />)}
            </NavigationMenuItem>
            <NavigationMenuItem className="relative">
                <NavigationMenuLink
                    href="/chat"
                    className={navigationMenuTriggerStyle()}
                >
                    <MessageCircleIcon className="w-4 h-4 mr-1" />
                    Ask
                </NavigationMenuLink>
                {isActive('/chat') && <ActiveIndicator />}
            </NavigationMenuItem>
            <NavigationMenuItem className="relative">
                <NavigationMenuLink
                    href="/repos"
                    className={navigationMenuTriggerStyle()}
                >
                    <BookMarkedIcon className="w-4 h-4 mr-1" />
                    <span className="mr-2">Repositories</span>
                    <Badge variant="secondary" className="px-1.5 relative">
                        {getShortenedNumberDisplayString(numberOfRepos)}
                        {isReposButtonNotificationDotVisible && <NotificationDot className="absolute -right-0.5 -top-0.5" />}
                    </Badge>
                </NavigationMenuLink>
                {isActive('/repos') && <ActiveIndicator />}
            </NavigationMenuItem>
            {isAuthenticated && (
                <NavigationMenuItem className="relative">
                    <NavigationMenuLink
                        href="/settings"
                        className={navigationMenuTriggerStyle()}
                    >
                        <SettingsIcon className="w-4 h-4 mr-1" />
                        Settings
                        {isSettingsButtonNotificationDotVisible && <NotificationDot className="absolute -right-0.5 -top-0.5" />}
                    </NavigationMenuLink>
                    {isActive('/settings') && <ActiveIndicator />}
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
