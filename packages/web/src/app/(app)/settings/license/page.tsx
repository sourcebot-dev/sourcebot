import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { ActivationCodeCard } from "./activationCodeCard";
import { CurrentPlanCard } from "./currentPlanCard";
import { RecentInvoicesCard } from "./recentInvoicesCard";
import { getAllInvoices } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";

export default authenticatedPage(async ({ prisma, org }) => {
    const license = await prisma.license.findUnique({
        where: { orgId: org.id },
    });

    const invoicesResult = license ? await getAllInvoices() : null;
    const invoices = invoicesResult && !isServiceError(invoicesResult) ? invoicesResult : [];

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">License</h3>
                <p className="text-sm text-muted-foreground">Manage your license.</p>
            </div>
            {license && <CurrentPlanCard license={license} />}
            {!license && <ActivationCodeCard />}
            {license && <RecentInvoicesCard invoices={invoices} />}
        </div>
    );
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings'
});
