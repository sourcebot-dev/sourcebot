import { prisma } from "@/prisma";
import { notFound, redirect } from 'next/navigation';
import { auth } from "@/auth";
import { getUser } from "@/data/user";
import { AcceptInviteButton } from "./components/acceptInviteButton"
import Image from "next/image";
import logoDark from "@/public/sb_logo_dark_large.png";
import logoLight from "@/public/sb_logo_light_large.png";
import { fetchSubscription } from "@/actions";
import { isServiceError } from "@/lib/utils";

interface RedeemPageProps {
    searchParams?: {
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
                <Image
                    src={logoDark}
                    className="h-18 md:h-40 w-auto hidden dark:block"
                    alt={"Sourcebot logo"}
                    priority={true}
                />
                <Image
                    src={logoLight}
                    className="h-18 md:h-40 w-auto block dark:hidden"
                    alt={"Sourcebot logo"}
                    priority={true}
                />
            </div>
            <div className="flex justify-center items-center">
                <h1>{title}</h1>
            </div>
        </div>
    );
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
            <ErrorLayout title="This invite has either expired or was revoked. Contact your organization owner." />
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
                <ErrorLayout title={`This invite doesn't belong to you. You're currently signed in with ${user.email}`} />
            )
        } else {
            const org = await prisma.org.findUnique({
                where: { id: invite.orgId },
            });

            if (!org) {
                return (
                    <ErrorLayout title="This organization wasn't found. Please contact your organization owner." />
                )
            }

            const stripeCustomerId = org.stripeCustomerId;
            if (stripeCustomerId) {
                const subscription = await fetchSubscription(org.domain);
                if (isServiceError(subscription)) {
                    return (
                        <ErrorLayout title="This organization's subscription has expired. Please renew the subscription and try again." />
                    )
                }
            }

            return (
                <div className="flex flex-col justify-center items-center mt-8 mb-8 md:mt-18 w-full px-5">
                    <div className="max-h-44 w-auto mb-4">
                        <Image
                            src={logoDark}
                            className="h-18 md:h-40 w-auto hidden dark:block"
                            alt={"Sourcebot logo"}
                            priority={true}
                        />
                        <Image
                            src={logoLight}
                            className="h-18 md:h-40 w-auto block dark:hidden"
                            alt={"Sourcebot logo"}
                            priority={true}
                        />
                    </div>
                    <div className="flex justify-between items-center w-full max-w-2xl">
                        <h1 className="text-2xl font-bold">You have been invited to org {org.name}</h1>
                        <AcceptInviteButton invite={invite} userId={user.id} />
                    </div>
                </div>
            );
        }
    } else {
        redirect(`/login?callbackUrl=${encodeURIComponent(`/redeem?invite_id=${invite_id}`)}`);
    }
}
