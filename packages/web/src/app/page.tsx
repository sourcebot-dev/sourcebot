import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { prisma } from "@/prisma";

// @note: we were hitting `PrismaClientInitializationError` errors during
// build time. Next.js performs a static generation probe on all pages during
// `next build`, running each page component to determine if it's static or
// dynamic. `force-dynamic` skips the probe entirely so this page is always
// rendered at request time.
export const dynamic = 'force-dynamic';

export default async function Page() {
    const org = await prisma.org.findUnique({
        where: {
            domain: SINGLE_TENANT_ORG_DOMAIN
        }
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