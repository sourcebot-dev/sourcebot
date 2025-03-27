import { notFound, redirect } from 'next/navigation';
import { auth } from "@/auth";
import { getInviteInfo } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { AcceptInviteCard } from './components/acceptInviteCard';
import { LogoutEscapeHatch } from '../components/logoutEscapeHatch';
import { InviteNotFoundCard } from './components/inviteNotFoundCard';

interface RedeemPageProps {
    searchParams: {
        invite_id?: string;
    };
}

export default async function RedeemPage({ searchParams }: RedeemPageProps) {
    const inviteId = searchParams.invite_id;
    if (!inviteId) {
        return notFound();
    }

    const session = await auth();
    if (!session) {
        return redirect(`/login?callbackUrl=${encodeURIComponent(`/redeem?invite_id=${inviteId}`)}`);
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
                    orgDomain={inviteInfo.orgDomain}
                    host={inviteInfo.host}
                    recipient={inviteInfo.recipient}
                    orgImageUrl={inviteInfo.orgImageUrl}
                />
            )}
        </div>
    );
}
