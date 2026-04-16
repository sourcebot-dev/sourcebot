import { auth } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { getSidebarNavGroups } from "@/app/(app)/settings/layout";
import { SidebarBase } from "../sidebarBase";
import { Nav } from "./nav";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

export async function SettingsSidebar() {
    const session = await auth();

    const sidebarNavGroups = await getSidebarNavGroups();
    if (isServiceError(sidebarNavGroups)) {
        throw new ServiceErrorException(sidebarNavGroups);
    }

    return (
        <SidebarBase
            session={session}
            collapsible="none"
            headerContent={
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
        >
            <Nav groups={sidebarNavGroups} />
        </SidebarBase>
    );
}
