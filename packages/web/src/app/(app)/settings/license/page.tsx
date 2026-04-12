import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { ActivationCodeCard } from "./activationCodeCard";
import { PurchaseButton } from "./purchaseButton";
import { BasicSettingsCard } from "../components/settingsCard";
import { getPlan } from "@/lib/entitlements";

export default authenticatedPage(async ({ prisma, org }) => {
    const license = await prisma.license.findUnique({
        where: { orgId: org.id },
    });

    const plan = await getPlan();

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">License</h3>
                <p className="text-sm text-muted-foreground">Manage your license.</p>
            </div>
            <BasicSettingsCard
                name="Current plan"
                description="Your active Sourcebot plan."
            >
                <span className="text-sm font-medium">{plan}</span>
            </BasicSettingsCard>
            <ActivationCodeCard isActivated={!!license} />
            <PurchaseButton />
        </div>
    );
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings'
});
