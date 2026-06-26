import { auth } from "@/auth";
import { __unsafePrisma } from "@/prisma";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { AuthMethodSelector } from "@/app/components/authMethodSelector";
import { JoinOrganizationCard } from "@/features/membership/components/joinOrganizationCard";
import { NotProvisionedCard } from "@/features/membership/components/notProvisionedCard";
import { isScimEnabled } from "@/features/scim/utils";
import { activeOrPendingMembershipWhere } from "@/features/membership/utils";

interface InvitePageProps {
    searchParams: Promise<{
        id?: string;
    }>;
}

export default async function InvitePage(props: InvitePageProps) {
    const searchParams = await props.searchParams;
    const org = await __unsafePrisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
    if (!org || !org.isOnboarded) {
        return redirect("/onboard");
    }

    const inviteLinkId = searchParams.id;
    if (!org.inviteLinkEnabled || !inviteLinkId || org.inviteLinkId !== inviteLinkId) {
        return notFound();
    }

    const session = await auth();
    if (!session) {
        return <WelcomeCard inviteLinkId={inviteLinkId} />;
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
        return <NotProvisionedCard />;
    }

    // User is logged in but not a member, show join invitation
    return (
        <JoinOrganizationCard />   
    );
}

function WelcomeCard({ inviteLinkId }: { inviteLinkId: string; }) {
    return (    
        <div className="min-h-screen bg-gradient-to-br from-[var(--background)] to-[var(--accent)]/30 flex items-center justify-center p-6">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <SourcebotLogo className="h-12 mb-4 mx-auto" size="large" />
                    <CardTitle className="text-2xl font-semibold">
                        Welcome to Sourcebot
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center space-y-3">
                        <p className="text-[var(--muted-foreground)] text-[15px] leading-6">
                            You&apos;ve been invited to join this Sourcebot deployment. Sign up to get started.
                        </p>
                    </div>  

                    <AuthMethodSelector
                        callbackUrl={`/invite?id=${inviteLinkId}`}
                        context="signup"
                        securityNoticeClosable={true}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
