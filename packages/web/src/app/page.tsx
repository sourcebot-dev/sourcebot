import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { getOrgFromDomain } from "@/data/org";

export default async function Page() {
    const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);

    if (!org || !org.isOnboarded) {
        return redirect("/onboard");
    }

    const session = await auth();
    if (!session) {
        return redirect("/login");
    }

    return redirect(`/${SINGLE_TENANT_ORG_DOMAIN}`);
}