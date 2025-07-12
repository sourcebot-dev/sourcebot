import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { redirect } from "next/navigation";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";

export default async function Page() {
    const org = await prisma.org.findUnique({
        where: {
            domain: SINGLE_TENANT_ORG_DOMAIN
        },
    });

    if (!org || !org.isOnboarded) {
        return redirect("/onboard");
    }

    const session = await auth();
    if (!session) {
        return redirect("/login");
    }

    return redirect(`/${SINGLE_TENANT_ORG_DOMAIN}`);
}