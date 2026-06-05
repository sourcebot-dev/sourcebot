import { redirect } from "next/navigation";
import { getSidebarNavGroups } from "./layout";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { auth } from "@/auth";

export default async function SettingsPage() {
    const session = await auth();
    if (!session) {
        return redirect(`/`);
    }

    const groups = await getSidebarNavGroups();
    if (isServiceError(groups)) {
        throw new ServiceErrorException(groups);
    }
    return redirect(groups[0].items[0].href);
}
