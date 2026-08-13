import { authenticatedPage } from "@/middleware/authenticatedPage";
import { listServiceAccounts } from "@/features/serviceAccounts/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { OrgRole } from "@sourcebot/db";
import { ServiceAccountsPage } from "./serviceAccountsPage";

export default authenticatedPage(async () => {
    const serviceAccounts = await listServiceAccounts();
    if (isServiceError(serviceAccounts)) {
        throw new ServiceErrorException(serviceAccounts);
    }

    return (
        <div className="flex flex-1 min-h-0 flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Service Accounts</h3>
                <p className="text-sm text-muted-foreground">
                    Service accounts are non-human identities for programmatic access to Sourcebot.
                    Unlike a member&apos;s own API keys, service accounts are managed centrally, don&apos;t consume a seat, and don&apos;t appear in your members list.
                </p>
            </div>
            <ServiceAccountsPage serviceAccounts={serviceAccounts} />
        </div>
    );
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings',
});
