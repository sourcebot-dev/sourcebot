import { hasEntitlement } from "@sourcebot/shared";
import { notFound } from "@/lib/serviceError";
import { LinkedAccountsSettings } from "@/ee/features/permissionSyncing/linkedAccountsSettings";

export default async function PermissionSyncingPage() {
    const hasPermissionSyncingEntitlement = await hasEntitlement("permission-syncing");
    if (!hasPermissionSyncingEntitlement) {
        notFound();
    }

    return <LinkedAccountsSettings />;
}
