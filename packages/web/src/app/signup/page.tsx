import { auth } from "@/auth";
import { LoginForm } from "../login/components/loginForm";
import { redirect } from "next/navigation";
import { Footer } from "@/app/components/footer";
import { createLogger } from "@sourcebot/logger";
import { getAuthProviders } from "@/lib/authProviders";
import { getOrgFromDomain } from "@/data/org";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";

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

    const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
    if (!org || !org.isOnboarded) {
        return redirect("/onboard");
    }

    const providers = getAuthProviders();
    return (
        <div className="flex flex-col min-h-screen bg-backgroundSecondary">
            <div className="flex-1 flex flex-col items-center p-4 sm:p-12 w-full">
                <LoginForm
                    callbackUrl={searchParams.callbackUrl}
                    error={searchParams.error}
                    providers={providers}
                    context="signup"
                />
            </div>
            <Footer />
        </div>
    )
}
