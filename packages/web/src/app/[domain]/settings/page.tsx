import { redirect } from "next/navigation";
import { getSidebarNavItems } from "./layout";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { auth } from "@/auth";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";

export default async function SettingsPage() {
    const session = await auth();
    if (!session) {
        return redirect(`/${SINGLE_TENANT_ORG_DOMAIN}`);
    }

    const items = await getSidebarNavItems();
    if (isServiceError(items)) {
        throw new ServiceErrorException(items);
    }
    return redirect(items[0].href);
}
