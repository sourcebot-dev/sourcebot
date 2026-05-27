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
import { useEntitlements } from "@/features/entitlements/useEntitlements";
import { Entitlement } from "@sourcebot/shared";
import {
    ChartAreaIcon,
    KeyRoundIcon,
    LinkIcon,
    type LucideIcon,
    PlugIcon,
    ScrollTextIcon,
    Settings2Icon,
    ShieldIcon,
    UserIcon,
    UsersIcon,
} from "lucide-react";
import { VscMcp } from "react-icons/vsc";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UpgradeBadge } from "../upgradeBadge";
import { IconType } from "react-icons/lib";

const iconMap = {
    "link": LinkIcon,
    "key-round": KeyRoundIcon,
    "shield": ShieldIcon,
    "users": UsersIcon,
    "plug": PlugIcon,
    "chart-area": ChartAreaIcon,
    "scroll-text": ScrollTextIcon,
    "settings": Settings2Icon,
    "user": UserIcon,
    "mcp": VscMcp,
} satisfies Record<string, LucideIcon | IconType>;

export type NavIconName = keyof typeof iconMap;

export type NavItem = {
    href: string;
    hrefRegex?: string;
    title: React.ReactNode;
    icon?: NavIconName;
    isNotificationDotVisible?: boolean;
    requiredEntitlement?: Entitlement;
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
    const entitlements = useEntitlements();

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

                                const showUpgradeBadge =
                                    (item.requiredEntitlement && !entitlements.includes(item.requiredEntitlement));
                                
                                const Icon = item.icon ? iconMap[item.icon] : undefined;
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={isActive}>
                                            <Link href={item.href}>
                                                {Icon && <Icon />}
                                                <span>{item.title}</span>
                                                {showUpgradeBadge && <UpgradeBadge />}
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
