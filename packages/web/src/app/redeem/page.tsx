import { prisma } from "@/prisma";
import { notFound, redirect } from 'next/navigation';
import { NavigationMenu } from "../components/navigationMenu";
import { auth } from "@/auth";
import { getUser } from "@/data/user";
import { AcceptInviteButton } from "./components/acceptInviteButton"

interface RedeemPageProps {
    searchParams?: {
        invite_id?: string;
    };
}
  
export default async function RedeemPage({ searchParams }: RedeemPageProps) {
    const invite_id = searchParams?.invite_id;

    if (!invite_id) {
        notFound();
    }

    const invite = await prisma.invite.findUnique({
        where: { id: invite_id },
    });

    if (!invite) {
        return (
            <div>
            <NavigationMenu />
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <h1>This invite either expired or was revoked. Contact your organization owner.</h1>
            </div>
            </div>
        );
    }

    const session = await auth();
    let user = undefined;
    if (session) {
        user = await getUser(session.user.id);
    }


    // Auth case
    if (user) {
        if (user.email !== invite.recipientEmail) {
            return (
                <div>
                <NavigationMenu />
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <h1>Sorry this invite does not belong to you.</h1>
                </div>
                </div>
            )
        } else {
            const orgName = await prisma.org.findUnique({
                where: { id: invite.orgId },
                select: { name: true },
            });

            if (!orgName) {
                return (
                    <div>
                    <NavigationMenu />
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                        <h1>Organization not found. Please contact the invite sender.</h1>
                    </div>
                    </div>
                )
            }

            return (
                <div>
                    <NavigationMenu />
                    <div className="flex justify-between items-center h-screen px-6">
                        <h1 className="text-2xl font-bold">You have been invited to org {orgName.name}</h1>
                        <AcceptInviteButton invite={invite} userId={user.id} />
                    </div>
                </div>
            );
        }
    } else {
        redirect(`/login?callbackUrl=${encodeURIComponent(`/redeem?invite_id=${invite_id}`)}`);
    }
}
