import { auth } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { getSidebarNavGroups } from "@/app/(app)/settings/layout";
import { SidebarBase } from "../sidebarBase";
import { Nav } from "./nav";
import { SettingsSidebarHeader } from "./header";
import { isValidLicenseActive } from "@/lib/entitlements";
import { getAuthContext } from "@/middleware/withAuth";
import { OrgRole } from "@prisma/client";

export async function SettingsSidebar() {
    const session = await auth();

    const sidebarNavGroups = await getSidebarNavGroups();
    if (isServiceError(sidebarNavGroups)) {
        throw new ServiceErrorException(sidebarNavGroups);
    }

    const licenseActive = await isValidLicenseActive();

    const authContext = await getAuthContext();
    const isOwner = !isServiceError(authContext) && authContext.role === OrgRole.OWNER;

    return (
        <SidebarBase
            session={session}
            collapsible="none"
            isValidLicenseActive={licenseActive}
            isOwner={isOwner}
            headerContent={<SettingsSidebarHeader />}
        >
            <Nav groups={sidebarNavGroups} />
        </SidebarBase>
    );
}
