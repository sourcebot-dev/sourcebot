import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { getOfflineLicenseMetadata } from "@sourcebot/shared";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { ActivationCodeCard } from "./activationCodeCard";
import { CurrentPlanCard } from "./currentPlanCard";
import { OfflineLicenseCard } from "./offlineLicenseCard";
import { RecentInvoicesCard } from "./recentInvoicesCard";
import { getAllInvoices } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";

export default authenticatedPage(async ({ prisma, org }) => {
    const offlineLicense = getOfflineLicenseMetadata();
    const isOfflineLicenseExpired = offlineLicense
        ? new Date(offlineLicense.expiryDate).getTime() < Date.now()
        : false;

    const license = offlineLicense
        ? null
        : await prisma.license.findUnique({ where: { orgId: org.id } });

    const invoicesResult = license ? await getAllInvoices() : null;
    const invoices = invoicesResult && !isServiceError(invoicesResult) ? invoicesResult : [];

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">License</h3>
                <div className="flex items-center justify-between gap-6">
                    <p className="text-sm text-muted-foreground">
                        For questions about licenses or billing,{" "}
                        <a href="mailto:support@sourcebot.dev" className="text-primary hover:underline">
                            contact us
                        </a>
                    </p>
                    <Button variant="ghost" size="sm" className="text-muted-foreground h-6" asChild>
                        <a href="https://www.sourcebot.dev/pricing" target="_blank" rel="noopener noreferrer">
                            All plans
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </Button>
                </div>
            </div>
            {offlineLicense && (
                <OfflineLicenseCard license={offlineLicense} isExpired={isOfflineLicenseExpired} />
            )}
            {license && <CurrentPlanCard license={license} />}
            {license && <RecentInvoicesCard invoices={invoices} />}
            {!offlineLicense && !license && <ActivationCodeCard />}
        </div>
    );
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings'
});
