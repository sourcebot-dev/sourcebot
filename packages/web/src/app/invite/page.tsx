import { auth } from "@/auth";
import { prisma } from "@/prisma";
import { getOrgFromDomain } from "@/data/org";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { AuthMethodSelector } from "@/app/components/authMethodSelector";
import { JoinOrganizationButton } from "@/app/invite/components/joinOrganizationButton"
import { Button } from "@/components/ui/button";
import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch";
import { getAuthProviders } from "@/lib/authProviders";

interface InvitePageProps {
    searchParams: {
        id?: string;
    };
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
    const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
    if (!org || !org.isOnboarded) {
        return redirect("/onboard");
    }

    const inviteLinkId = searchParams.id;
    if (!org.inviteLinkEnabled || !inviteLinkId || org.inviteLinkId !== inviteLinkId) {
        return notFound();
    }

    const session = await auth();
    if (!session) {
        const providers = getAuthProviders();
        return <WelcomeCard inviteLinkId={inviteLinkId} providers={providers} />;
    }

    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: org.id,
                userId: session.user.id
            }
        }
    });

    // If already a member, redirect to the organization
    if (membership) {
        redirect(`/${SINGLE_TENANT_ORG_DOMAIN}`);
    }

    // User is logged in but not a member, show join invitation
    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            <JoinInvitationCard />
        </div>
    );
}

function WelcomeCard({ inviteLinkId, providers }: { inviteLinkId: string; providers: import("@/lib/authProviders").AuthProvider[] }) {
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
                            You've been invited to join this Sourcebot deployment. Sign up to get started.
                        </p>
                    </div>  

                    <AuthMethodSelector
                        providers={providers}
                        callbackUrl={`/invite?id=${inviteLinkId}`}
                        context="signup"
                        securityNoticeClosable={true}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

function JoinInvitationCard() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[var(--background)] to-[var(--accent)]/30 flex items-center justify-center p-6">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <SourcebotLogo className="h-12 mb-4 mx-auto" size="large" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center space-y-4">
                        <p className="text-[var(--muted-foreground)] text-[15px] leading-6">
                            Welcome to Sourcebot! Click the button below to join this organization.
                        </p>
                    </div>
                    <JoinOrganizationButton />
                </CardContent>
            </Card>
        </div>
    );
}
