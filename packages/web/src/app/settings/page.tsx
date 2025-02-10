import { Header } from "../components/header";
import { auth } from "@/auth";
import { getUser } from "@/data/user";
import { prisma } from "@/prisma";
import { MembersTable } from "./components/memberTable";

export default async function SettingsPage() {
    const session = await auth();
    if (!session) {
        return null;
    }

    const user = await getUser(session.user.id);
    if (!user || !user.activeOrgId) {
        return null;
    }

    const members = await prisma.user.findMany({
        where: {
            orgs: {
                some: {
                    orgId: user.activeOrgId,
                },
            },
        },
        include: {
            orgs: {
                where: {
                    orgId: user.activeOrgId,
                },
                select: {
                    role: true,
                },
            },
        },
    });

    const memberInfo = members.map((member) => ({
        name: member.name!,
        role: member.orgs[0].role,
    }));


    return (
        <div>
            <Header>
                <h1 className="text-3xl">Settings</h1>
            </Header>
            <div>
                <MembersTable initialMembers={memberInfo} />
            </div>
        </div>
    )
}