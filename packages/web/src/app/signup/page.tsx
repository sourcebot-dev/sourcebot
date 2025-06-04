import { auth } from "@/auth";
import { LoginForm } from "../login/components/loginForm";
import { redirect } from "next/navigation";
import { getProviders } from "@/auth";
import { Footer } from "@/app/components/footer";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('signup-page');

interface LoginProps {
    searchParams: {
        callbackUrl?: string;
        error?: string;
    }
}

export default async function Signup({ searchParams }: LoginProps) {
    const session = await auth();
    if (session) {
        logger.info("Session found in signup page, redirecting to home");
        return redirect("/");
    }

    const providers = getProviders();
    const providerData = providers
        .map((provider) => {
            if (typeof provider === "function") {
                const providerInfo = provider()
                return { id: providerInfo.id, name: providerInfo.name }
            } else {
                return { id: provider.id, name: provider.name }
            }
        });

    return (
        <div className="flex flex-col min-h-screen bg-backgroundSecondary">
            <div className="flex-1 flex flex-col items-center p-4 sm:p-12 w-full">
                <LoginForm
                    callbackUrl={searchParams.callbackUrl}
                    error={searchParams.error}
                    providers={providerData}
                    context="signup"
                />
            </div>
            <Footer />
        </div>
    )
}
