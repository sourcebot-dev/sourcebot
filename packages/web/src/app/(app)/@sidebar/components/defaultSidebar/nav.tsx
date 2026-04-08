"use client";

import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BookMarkedIcon, type LucideIcon, MessageCircleIcon, MessagesSquareIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { NotificationDot } from "../../../components/notificationDot";

interface NavItem {
    title: string;
    href: string;
    icon: LucideIcon;
    key: string;
    requiresAuth?: boolean;
}

const baseItems: NavItem[] = [
    {
        title: "Code Search",
        href: "/search",
        icon: SearchIcon,
        key: "search",
    },
    {
        title: "Ask",
        href: "/chat",
        icon: MessageCircleIcon,
        key: "chat"
    },
    {
        title: "Chats",
        href: "/chats",
        icon: MessagesSquareIcon,
        key: "chats",
        requiresAuth: true,
    },
    {
        title: "Repositories",
        href: "/repos",
        icon: BookMarkedIcon,
        key: "repos"
    },
    {
        title: "Settings",
        href: "/settings",
        icon: SettingsIcon,
        key: "settings",
        requiresAuth: true
    },
];

interface NavProps {
    isSettingsNotificationVisible?: boolean;
    isSignedIn?: boolean;
}

export function Nav({ isSettingsNotificationVisible, isSignedIn }: NavProps) {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === "/search") {
            return pathname === "/" || pathname.startsWith("/search");
        }
        if (href === "/chat") {
            return pathname === "/chat";
        }
        return pathname.startsWith(href);
    };

    return (
        <SidebarMenu>
            {baseItems.filter((item) => !item.requiresAuth || isSignedIn).map((item) => {
                const showNotification =
                    (item.key === "settings" && isSettingsNotificationVisible);
                return (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <a href={item.href}>
                                <item.icon />
                                <span>{item.title}</span>
                                {showNotification && <NotificationDot className="ml-1.5" />}
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                );
            })}
        </SidebarMenu>
    );
}
