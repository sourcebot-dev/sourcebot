import { authenticatedPage } from "@/middleware/authenticatedPage";
import { getServiceAccountApiKeysAction, listServiceAccounts } from "@/features/serviceAccounts/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { OrgRole } from "@sourcebot/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ServiceAccountApiKeysPage } from "./serviceAccountApiKeysPage";

export default authenticatedPage<{ params: Promise<{ id: string }> }>(async (_auth, { params }) => {
    const { id } = await params;

    const [serviceAccounts, apiKeys] = await Promise.all([
        listServiceAccounts(),
        getServiceAccountApiKeysAction(id),
    ]);

    if (isServiceError(serviceAccounts)) {
        throw new ServiceErrorException(serviceAccounts);
    }

    const serviceAccount = serviceAccounts.find((sa) => sa.id === id);
    if (!serviceAccount) {
        return notFound();
    }

    if (isServiceError(apiKeys)) {
        throw new ServiceErrorException(apiKeys);
    }

    return (
        <div className="flex flex-1 min-h-0 flex-col gap-6">
            <div>
                <Link
                    href="/settings/serviceAccounts"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Service Accounts
                </Link>
                <h3 className="text-lg font-medium">{serviceAccount.name}</h3>
                <p className="text-sm text-muted-foreground">
                    Create and manage API keys for this service account.
                </p>
            </div>
            <ServiceAccountApiKeysPage serviceAccountId={id} apiKeys={apiKeys} />
        </div>
    );
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings',
});
