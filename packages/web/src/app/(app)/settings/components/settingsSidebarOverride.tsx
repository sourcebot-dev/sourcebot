"use client";

import { SetSidebarOverride } from "@/app/(app)/components/appSidebar/sidebarOverrideContext";
import { NotificationDot } from "@/app/(app)/components/notificationDot";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ArrowLeftIcon } from "lucide-react";
import { DynamicIcon, IconName } from "lucide-react/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export type SidebarNavItem = {
    href: string;
    hrefRegex?: string;
    title: React.ReactNode;
    icon?: IconName;
    isNotificationDotVisible?: boolean;
};

export type SidebarNavGroup = {
    label: string;
    items: SidebarNavItem[];
};

interface SettingsSidebarOverrideProps {
    groups: SidebarNavGroup[];
}

export function SettingsSidebarOverride({ groups }: SettingsSidebarOverrideProps) {
    return (
        <SetSidebarOverride
            header={
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href="/">
                                <ArrowLeftIcon />
                                <span>Back to app</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            }
            content={<SettingsSidebarContent groups={groups} />}
            collapsible="none"
        />
    );
}

function SettingsSidebarContent({ groups }: { groups: SidebarNavGroup[] }) {
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
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton asChild isActive={isActive}>
                                            <Link href={item.href}>
                                                {item.icon && <DynamicIcon name={item.icon} />}
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
