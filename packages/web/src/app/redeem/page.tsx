import { prisma } from "@/prisma";
import { notFound, redirect } from 'next/navigation';
import { NavigationMenu } from "../components/navigationMenu";
import { auth } from "@/auth";
import { getUser } from "@/data/user";
import { AcceptInviteButton } from "./components/acceptInviteButton"
import Image from "next/image";
import logoDark from "@/public/sb_logo_dark_large.png";
import logoLight from "@/public/sb_logo_light_large.png";

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
                    <h1>This invite has either expired or was revoked. Contact your organization owner.</h1>
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
                    <h1>This invite doesn't belong to you. You're currenly signed in with ${user.email}</h1>
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
                        <h1>This organization wasn't found. Please contact your organization owner.</h1>
                    </div>
                </div>
                )
            }

            return (
                <div>
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
