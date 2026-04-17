import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { ActivationCodeCard } from "./activationCodeCard";
import { PurchaseButton } from "./purchaseButton";
import { ManageSubscriptionButton } from "./manageSubscriptionButton";
import { RefreshLicenseButton } from "./refreshLicenseButton";
import { SettingsCard } from "../components/settingsCard";
import { getEntitlements } from "@/lib/entitlements";

export default authenticatedPage(async ({ prisma, org }) => {
    const license = await prisma.license.findUnique({
        where: { orgId: org.id },
    });

    const entitlements = await getEntitlements();

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">License</h3>
                <p className="text-sm text-muted-foreground">Manage your license.</p>
            </div>
            <SettingsCard>
                <span className="text-sm font-medium">{entitlements.join(", ")}</span>
            </SettingsCard>
            <ActivationCodeCard isActivated={!!license} />
            <div className="flex gap-3">
                <PurchaseButton />
                {license && <ManageSubscriptionButton />}
                {license && <RefreshLicenseButton />}
            </div>
        </div>
    );
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings'
});
