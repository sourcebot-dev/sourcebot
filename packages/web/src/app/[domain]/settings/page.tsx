import { auth } from "@/auth"
import { getUser } from "@/data/user"
import { prisma } from "@/prisma"
import { MemberTable } from "./components/memberTable"
import { MemberInviteForm } from "./components/memberInviteForm"
import { InviteTable } from "./components/inviteTable"
import { Separator } from "@/components/ui/separator"

interface SettingsPageProps {
    params: {
        domain: string
    }
}

export default async function SettingsPage({ params: { domain } }: SettingsPageProps) {
    const fetchData = async () => {
        const session = await auth()
        if (!session) {
            return null
        }

        const user = await getUser(session.user.id)
        if (!user) {
            return null
        }

        const activeOrg = await prisma.org.findUnique({
            where: {
                domain,
            },
        })

        if (!activeOrg) {
            return null
        }

        const members = await prisma.user.findMany({
            where: {
                orgs: {
                    some: {
                        orgId: activeOrg.id,
                    },
                },
            },
            include: {
                orgs: {
                    where: {
                        orgId: activeOrg.id,
                    },
                    select: {
                        role: true,
                    },
                },
            },
        })

        const invites = await prisma.invite.findMany({
            where: {
                orgId: activeOrg.id,
            },
        })

        const memberInfo = members.map((member) => ({
            id: member.id,
            name: member.name!,
            email: member.email!,
            role: member.orgs[0].role,
        }))

        const inviteInfo = invites.map((invite) => ({
            id: invite.id,
            email: invite.recipientEmail,
            createdAt: invite.createdAt,
        }))

        return {
            user,
            memberInfo,
            inviteInfo,
            activeOrg,
        }
    }

    const data = await fetchData()
    if (!data) {
        return <div>Error: Unable to fetch data</div>
    }
    const { user, memberInfo, inviteInfo } = data

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Members</h3>
                <p className="text-sm text-muted-foreground">Invite and manage members of your organization.</p>
            </div>
            <Separator />
            <div className="space-y-6">
                <MemberTable currentUserId={user.id} initialMembers={memberInfo} />
                <MemberInviteForm userId={user.id} />
                <InviteTable initialInvites={inviteInfo} />
            </div>
        </div>
    )
}

