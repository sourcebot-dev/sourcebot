import { Header } from "../components/header";
import { auth } from "@/auth";
import { getUser } from "@/data/user";
import { prisma } from "@/prisma";
import { MemberTable } from "./components/memberTable";
import { MemberInviteForm } from "./components/memberInviteForm";
import { InviteTable } from "./components/inviteTable";

export default async function SettingsPage() {
    const fetchData = async () => {
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

        const invites = await prisma.invite.findMany({
            where: {
                orgId: user.activeOrgId,
            },
        });

        const memberInfo = members.map((member) => ({
            name: member.name!,
            role: member.orgs[0].role,
        }));

        const inviteInfo = invites.map((invite) => ({
            email: invite.recipientEmail,
            createdAt: invite.createdAt,
        }));

        return { user, memberInfo, inviteInfo };
    };

    const data = await fetchData();
    if (!data) {
        return <div>Error: Unable to fetch data</div>;
    }
    const { user, memberInfo, inviteInfo } = data;


    return (
        <div>
            <Header>
                <h1 className="text-3xl">Settings</h1>
            </Header>
            <div>
                <MemberInviteForm orgId={user.activeOrgId!} userId={user.id} />
                <InviteTable initialInvites={inviteInfo} />
                <MemberTable initialMembers={memberInfo} />
            </div>
        </div>
    )
}