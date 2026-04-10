"use client";

import { NotificationDot } from "@/app/(app)/components/notificationDot";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
    ChartAreaIcon,
    KeyRoundIcon,
    LinkIcon,
    type LucideIcon,
    PlugIcon,
    ScrollTextIcon,
    ShieldIcon,
    UserIcon,
    UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const iconMap = {
    "link": LinkIcon,
    "key-round": KeyRoundIcon,
    "shield": ShieldIcon,
    "users": UsersIcon,
    "plug": PlugIcon,
    "chart-area": ChartAreaIcon,
    "scroll-text": ScrollTextIcon,
    "user": UserIcon,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof iconMap;

export type NavItem = {
    href: string;
    hrefRegex?: string;
    title: React.ReactNode;
    icon?: NavIconName;
    isNotificationDotVisible?: boolean;
};

export type NavGroup = {
    label: string;
    items: NavItem[];
};

interface NavProps {
    groups: NavGroup[];
}

export function Nav({ groups }: NavProps) {
    const pathname = usePathname();

    return (
        <>
            {groups.map((group) => (
                <SidebarGroup key={group.label}>
                    <SidebarGroupLabel className="text-muted-foreground">{group.label}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {group.items.map((item) => {
                                const isActive = item.hrefRegex
                                    ? new RegExp(item.hrefRegex).test(pathname)
                                    : pathname === item.href;
                                const Icon = item.icon ? iconMap[item.icon] : undefined;
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={isActive}>
                                            <Link href={item.href}>
                                                {Icon && <Icon />}
                                                <span>{item.title}</span>
                                                {item.isNotificationDotVisible && <NotificationDot className="ml-1.5" />}
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            ))}
        </>
    );
}
