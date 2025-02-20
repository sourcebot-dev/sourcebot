import { notFound, redirect } from 'next/navigation';
import { auth } from "@/auth";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { getInviteInfo } from "@/actions";
import { isServiceError } from "@/lib/utils";
interface RedeemPageProps {
    searchParams: {
        invite_id?: string;
    };
}

interface ErrorLayoutProps {
    title: string;
}

function ErrorLayout({ title }: ErrorLayoutProps) {
    return (
        <div className="flex flex-col justify-center items-center mt-8 mb-8 md:mt-18 w-full px-5">
            <div className="max-h-44 w-auto mb-4">
                <SourcebotLogo
                    className="h-18 md:h-40"
                    size="large"
                />
            </div>
            <div className="flex justify-center items-center">
                <h1>{title}</h1>
            </div>
        </div>
    );
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
    if (isServiceError(inviteInfo)) {
        return (
            <p>Invite not found</p>
        );
    }

    return (
        <p>
            hello
        </p>
    );
}
