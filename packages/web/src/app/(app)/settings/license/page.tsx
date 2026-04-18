import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { ActivationCodeCard } from "./activationCodeCard";
import { CurrentPlanCard } from "./currentPlanCard";

export default authenticatedPage(async ({ prisma, org }) => {
    const license = await prisma.license.findUnique({
        where: { orgId: org.id },
    });

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">License</h3>
                <p className="text-sm text-muted-foreground">Manage your license.</p>
            </div>
            {license && <CurrentPlanCard license={license} />}
            {!license && <ActivationCodeCard />}
        </div>
    );
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings'
});
