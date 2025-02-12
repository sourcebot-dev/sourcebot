import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { redirect } from "next/navigation";

export default async function Page() {
    const session = await auth();
    if (!session) {
        return redirect("/login");
    }

    const firstOrg = await prisma.userToOrg.findFirst({
        where: {
            userId: session.user.id,
            org: {
                members: {
                    some: {
                        userId: session.user.id,
                    }
                }
            }
        },
        include: {
            org: true
        },
        orderBy: {
            joinedAt: "asc"
        }
    });

    if (!firstOrg) {
        return redirect("/onboard");
    }

    return redirect(`/${firstOrg.org.domain}`);
}