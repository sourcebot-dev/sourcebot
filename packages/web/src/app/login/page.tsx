import { auth } from "@/auth";
import { LoginForm } from "./components/loginForm";
import { redirect } from "next/navigation";
import { Footer } from "@/app/components/footer";
import { getIdentityProviderMetadata } from "@/lib/identityProviders";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { prisma } from "@/prisma";
import { getAnonymousAccessStatus } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { env } from "@sourcebot/shared";

interface LoginProps {
    searchParams: Promise<{
        callbackUrl?: string;
        error?: string;
    }>
}

export default async function Login(props: LoginProps) {
    const searchParams = await props.searchParams;
    const session = await auth();
    if (session) {
        return redirect("/");
    }

    const org = await prisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
    if (!org || !org.isOnboarded) {
        return redirect("/onboard");
    }

    const providers = getIdentityProviderMetadata();
    const anonymousAccessStatus = await getAnonymousAccessStatus();
    const isAnonymousAccessEnabled = !isServiceError(anonymousAccessStatus) && anonymousAccessStatus;

    return (
        <div className="flex flex-col min-h-screen bg-backgroundSecondary">
            <div className="flex-1 flex flex-col items-center p-4 sm:p-12 w-full">
                <LoginForm
                    callbackUrl={searchParams.callbackUrl}
                    error={searchParams.error}
                    providers={providers}
                    context="login"
                    isAnonymousAccessEnabled={isAnonymousAccessEnabled}
                    hideSecurityNotice={env.EXPERIMENT_ASK_GH_ENABLED === 'true'}
                />
            </div>
            <Footer />
        </div>
    )
}
