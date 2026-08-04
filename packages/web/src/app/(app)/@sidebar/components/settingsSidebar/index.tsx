import { auth } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { getSidebarNavGroups } from "@/app/(app)/settings/layout";
import { SidebarBase } from "../sidebarBase";
import { Nav } from "./nav";
import { SettingsSidebarHeader } from "./header";
import { isValidLicenseActive } from "@/lib/entitlements";
import { env } from "@sourcebot/shared";

export async function SettingsSidebar() {
    const session = await auth();

    const sidebarNavGroups = await getSidebarNavGroups();
    if (isServiceError(sidebarNavGroups)) {
        throw new ServiceErrorException(sidebarNavGroups);
    }

    const licenseActive = await isValidLicenseActive();

    return (
        <SidebarBase
            session={session}
            collapsible="none"
            isValidLicenseActive={licenseActive}
            isAskGhEnabled={env.EXPERIMENT_ASK_GH_ENABLED === 'true'}
            headerContent={<SettingsSidebarHeader />}
        >
            <Nav groups={sidebarNavGroups} />
        </SidebarBase>
    );
}
