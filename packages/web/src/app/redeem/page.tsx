import { notFound, redirect } from 'next/navigation';
import { auth } from "@/auth";
import { getInviteInfo } from "@/features/membership/actions";
import { isServiceError } from "@/lib/utils";
import { AcceptInviteCard } from './components/acceptInviteCard';
import { LogoutEscapeHatch } from '../components/logoutEscapeHatch';
import { InviteNotFoundCard } from './components/inviteNotFoundCard';
import { SINGLE_TENANT_ORG_ID } from '@/lib/constants';
import { __unsafePrisma } from '@/prisma';
import { isScimEnabled } from '@/features/scim/utils';
import { NotProvisionedCard } from '@/features/membership/components/notProvisionedCard';
import { activeOrPendingMembershipWhere } from '@/features/membership/utils';

interface RedeemPageProps {
    searchParams: Promise<{
        invite_id?: string;
    }>;
}

export default async function RedeemPage(props: RedeemPageProps) {
    const searchParams = await props.searchParams;
    const org = await __unsafePrisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
    if (!org || !org.isOnboarded) {
        return redirect("/onboard");
    }

    const inviteId = searchParams.invite_id;
    if (!inviteId) {
        return notFound();
    }

    const session = await auth();
    if (!session) {
        return redirect(`/login?callbackUrl=${encodeURIComponent(`/redeem?invite_id=${inviteId}`)}`);
    }

    const membership = await __unsafePrisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: org.id,
                userId: session.user.id
            },
            ...activeOrPendingMembershipWhere(),
        }
    });

    // If already a member, redirect to the organization
    if (membership) {
        redirect(`/`);
    }

    if (await isScimEnabled(org)) {
        return <NotProvisionedCard />
    }

    const inviteInfo = await getInviteInfo(inviteId);

    return (
        <div className="flex flex-col items-center min-h-screen py-24 bg-backgroundSecondary relative">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-12" />
            {isServiceError(inviteInfo) ? (
                <InviteNotFoundCard />
            ) : (
                <AcceptInviteCard
                    inviteId={inviteId}
                    orgName={inviteInfo.orgName}
                    host={inviteInfo.host}
                    recipient={inviteInfo.recipient}
                    orgImageUrl={inviteInfo.orgImageUrl}
                />
            )}
        </div>
    );
}
