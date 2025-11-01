import { auth } from "@/auth";
import { LoginForm } from "./components/loginForm";
import { redirect } from "next/navigation";
import { Footer } from "@/app/components/footer";
import { getIdentityProviderMetadata } from "@/lib/authProviders";
import { getOrgFromDomain } from "@/data/org";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";

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

    const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
    if (!org || !org.isOnboarded) {
        return redirect("/onboard");
    }

    const providers = getIdentityProviderMetadata();
    return (
        <div className="flex flex-col min-h-screen bg-backgroundSecondary">
            <div className="flex-1 flex flex-col items-center p-4 sm:p-12 w-full">
                <LoginForm
                    callbackUrl={searchParams.callbackUrl}
                    error={searchParams.error}
                    providers={providers}
                    context="login"
                />
            </div>
            <Footer />
        </div>
    )
}
