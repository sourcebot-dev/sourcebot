import { hasEntitlement } from "@sourcebot/shared";
import { notFound } from "next/navigation"
import { LinkedAccountsSettings } from "@/ee/features/permissionSyncing/components/linkedAccountsSettings";

export default async function PermissionSyncingPage() {
    const hasPermissionSyncingEntitlement = await hasEntitlement("permission-syncing");
    if (!hasPermissionSyncingEntitlement) {
        return notFound();
    }

    return <LinkedAccountsSettings />;
}
