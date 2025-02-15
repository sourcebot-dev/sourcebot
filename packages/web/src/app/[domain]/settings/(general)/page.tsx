import { auth } from "@/auth"
import { getUser } from "@/data/user"
import { prisma } from "@/prisma"
import { MemberTable } from "../components/memberTable"
import { MemberInviteForm } from "../components/memberInviteForm"
import { InviteTable } from "../components/inviteTable"
import { Separator } from "@/components/ui/separator"
import { getCurrentUserRole } from "@/actions"  
import { isServiceError } from "@/lib/utils"

interface GeneralSettingsPageProps {
    params: {
        domain: string
    }
}

export default async function GeneralSettingsPage({ params: { domain } }: GeneralSettingsPageProps) {
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

        const currentUserRole = await getCurrentUserRole(domain)
        if (isServiceError(currentUserRole)) {
            return null
        }

        return {
            user,
            memberInfo,
            inviteInfo,
            userRole: currentUserRole,
        }
    }

    const data = await fetchData()
    if (!data) {
        return <div>Error: Unable to fetch data</div>
    }
    const { user, memberInfo, inviteInfo, userRole } = data

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Members</h3>
                <p className="text-sm text-muted-foreground">Invite and manage members of your organization.</p>
            </div>
            <Separator />
            <div className="space-y-6">
                <MemberTable currentUserRole={userRole} currentUserId={user.id} initialMembers={memberInfo} />
                <MemberInviteForm userId={user.id} currentUserRole={userRole} />
                <InviteTable initialInvites={inviteInfo} />
            </div>
        </div>
    )
}

