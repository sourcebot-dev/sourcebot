import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { getOfflineLicenseMetadata } from "@sourcebot/shared";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";
import { ActivationCodeCard } from "./activationCodeCard";
import { CurrentPlanCard } from "./currentPlanCard";
import { OfflineLicenseCard } from "./offlineLicenseCard";
import { RecentInvoicesCard } from "./recentInvoicesCard";
import { getAllInvoices } from "@/ee/features/lighthouse/actions";
import { syncWithLighthouse } from "@/ee/features/lighthouse/servicePing";
import { isServiceError } from "@/lib/utils";

type LicensePageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
} & Record<string, unknown>;

export default authenticatedPage<LicensePageProps>(async ({ prisma, org }, props) => {
    const searchParams = await props.searchParams;
    if (searchParams?.refresh === 'true' || searchParams?.trial_used === 'true') {
        // Side-trips to the Stripe portal (add PM, manage sub) include
        // ?refresh=true so we resync immediately instead of waiting for
        // the daily ping. Trial checkout returns add ?trial_used=true so
        // we can flag the org as having used its trial even before the
        // license row exists (the user still needs to enter the
        // activation code from email before syncWithLighthouse has
        // anything to pull).
        if (searchParams.refresh === 'true') {
            await syncWithLighthouse(org.id).catch(() => {
                // ignore failure
            });
        }
        if (searchParams.trial_used === 'true' && org.trialUsedAt === null) {
            await prisma.org.update({
                where: { id: org.id, trialUsedAt: null },
                data: { trialUsedAt: new Date() },
            }).catch(() => {
                // No-op: the flag was already set by another path.
            });
        }

        // Strip our params but preserve anything else (e.g. `checkout=success`).
        const preserved = new URLSearchParams(searchParams as Record<string, string>);
        preserved.delete('refresh');
        preserved.delete('trial_used');
        const suffix = preserved.toString();
        redirect(suffix ? `/settings/license?${suffix}` : '/settings/license');
    }

    const offlineLicense = getOfflineLicenseMetadata();
    const isOfflineLicenseExpired = offlineLicense
        ? new Date(offlineLicense.expiryDate).getTime() < Date.now()
        : false;

    const license = offlineLicense
        ? null
        : await prisma.license.findUnique({ where: { orgId: org.id } });

    const invoicesResult = license ? await getAllInvoices() : null;
    const invoices = invoicesResult && !isServiceError(invoicesResult) ? invoicesResult : [];

    const isTrialEligible = !offlineLicense && org.trialUsedAt === null;

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
            {!offlineLicense && !license && <ActivationCodeCard isTrialEligible={isTrialEligible} />}
        </div>
    );
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings'
});
