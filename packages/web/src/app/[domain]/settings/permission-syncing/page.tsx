import { hasEntitlement } from "@sourcebot/shared";
import { notFound } from "@/lib/serviceError";
import { LinkedAccountsSettings } from "@/ee/features/permissionSyncing/linkedAccountsSettings";

interface PermissionSyncingPageProps {
    params: Promise<{
        domain: string;
    }>
}

export default async function PermissionSyncingPage(props: PermissionSyncingPageProps) {
    const params = await props.params;

    const hasPermissionSyncingEntitlement = await hasEntitlement("permission-syncing");
    if (!hasPermissionSyncingEntitlement) {
        notFound();
    }

    return <LinkedAccountsSettings domain={params.domain} />;
}
