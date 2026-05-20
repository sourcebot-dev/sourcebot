import { auth } from "@/auth";
import { LoginForm } from "../login/components/loginForm";
import { redirect } from "next/navigation";
import { Footer } from "@/app/components/footer";
import { getIdentityProviderMetadata } from "@/lib/identityProviders";
import { createLogger, env } from "@sourcebot/shared";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { __unsafePrisma } from "@/prisma";
import { isAnonymousAccessEnabled } from "@/lib/entitlements";

const logger = createLogger('signup-page');

interface LoginProps {
    searchParams: Promise<{
        callbackUrl?: string;
        error?: string;
    }>
}

export default async function Signup(props: LoginProps) {
    const searchParams = await props.searchParams;
    const session = await auth();
    if (session) {
        logger.info("Session found in signup page, redirecting to home");
        return redirect("/");
    }

    const org = await __unsafePrisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
    if (!org || !org.isOnboarded) {
        return redirect("/onboard");
    }

    const providers = await getIdentityProviderMetadata();
    const anonymousAccessEnabled = await isAnonymousAccessEnabled();

    return (
        <div className="flex flex-col min-h-screen bg-backgroundSecondary">
            <div className="flex-1 flex flex-col items-center p-4 sm:p-12 w-full">
                <LoginForm
                    callbackUrl={searchParams.callbackUrl}
                    error={searchParams.error}
                    providers={providers}
                    context="signup"
                    isAnonymousAccessEnabled={anonymousAccessEnabled}
                    hideSecurityNotice={env.EXPERIMENT_ASK_GH_ENABLED === 'true'}
                />
            </div>
            <Footer />
        </div>
    )
}
