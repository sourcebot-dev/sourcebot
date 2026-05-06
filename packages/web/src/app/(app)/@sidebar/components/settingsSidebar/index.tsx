import { auth } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { getSidebarNavGroups } from "@/app/(app)/settings/layout";
import { SidebarBase } from "../sidebarBase";
import { Nav } from "./nav";
import { SettingsSidebarHeader } from "./header";

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
            headerContent={<SettingsSidebarHeader />}
        >
            <Nav groups={sidebarNavGroups} />
        </SidebarBase>
    );
}
