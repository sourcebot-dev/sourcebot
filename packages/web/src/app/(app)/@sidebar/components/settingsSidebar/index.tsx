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
import { env } from "@sourcebot/shared";

export async function SettingsSidebar() {
    const session = await auth();

    const sidebarNavGroups = await getSidebarNavGroups();
    if (isServiceError(sidebarNavGroups)) {
        throw new ServiceErrorException(sidebarNavGroups);
    }

    const licenseActive = await isValidLicenseActive();

    // The "Upgrade" prompts in the sidebar (UpgradeButton in the footer
    // and the per-item UpgradeBadge) are only meaningful for the org's
    // owner — a MEMBER cannot act on the upgrade flow. See issue #1524.
    const authContext = await getAuthContext();
    const isOwner = !isServiceError(authContext) && authContext.role === OrgRole.OWNER;

    return (
        <SidebarBase
            session={session}
            collapsible="none"
            isValidLicenseActive={licenseActive}
            isAskGhEnabled={env.EXPERIMENT_ASK_GH_ENABLED === 'true'}
            isOwner={isOwner}
            headerContent={<SettingsSidebarHeader />}
        >
            <Nav groups={sidebarNavGroups} isOwner={isOwner} />
        </SidebarBase>
    );
}
