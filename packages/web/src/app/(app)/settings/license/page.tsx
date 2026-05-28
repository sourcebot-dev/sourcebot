import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { _isValidLicenseActive, getOfflineLicenseMetadata } from "@sourcebot/shared";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";
import { ActivationCodeCard } from "./activationCodeCard";
import { OnlineLicenseCard } from "./onlineLicenseCard";
import { OfflineLicenseCard } from "./offlineLicenseCard";
import { RecentInvoicesCard } from "./recentInvoicesCard";
import { SettingsCard } from "../components/settingsCard";
import { UpsellPanel } from "@/ee/features/lighthouse/upsellDialog";
import { getAllInvoices } from "@/ee/features/lighthouse/actions";
import { syncWithLighthouse } from "@/ee/features/lighthouse/servicePing";
import { isServiceError } from "@/lib/utils";

type LicensePageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
} & Record<string, unknown>;

export default authenticatedPage<LicensePageProps>(async ({ prisma, org }, props) => {
    const searchParams = await props.searchParams;
    if (searchParams?.refresh === 'true') {
        // Side-trips to the Stripe portal (add PM, manage sub) include
        // ?refresh=true so we resync immediately instead of waiting for
        // the daily ping.
        if (searchParams.refresh === 'true') {
            await syncWithLighthouse(org.id).catch(() => {
                // ignore failure
            });
        }
        // Strip our params but preserve anything else (e.g. `checkout=success`).
        const preserved = new URLSearchParams(searchParams as Record<string, string>);
        preserved.delete('refresh');
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

    // Show the upsell when the user has no usable license on this deployment:
    // either nothing is provisioned at all, or their online license has lapsed
    // (canceled/past_due/etc.). Offline licenses are out-of-band, so we don't
    // present a Stripe upgrade path for them.
    const isOnlineLicenseInactive = license ? !_isValidLicenseActive(license) : false;
    const showUpsell = !offlineLicense && (!license || isOnlineLicenseInactive);

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
            {showUpsell && (
                <SettingsCard>
                    <UpsellPanel source="license_settings" returnPath="/settings/license" />
                </SettingsCard>
            )}
            {offlineLicense && (
                <OfflineLicenseCard license={offlineLicense} isExpired={isOfflineLicenseExpired} />
            )}
            {license && <OnlineLicenseCard license={license} />}
            {!offlineLicense && !license && <ActivationCodeCard />}
            {license && <RecentInvoicesCard invoices={invoices} />}
        </div>
    );
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings'
});
