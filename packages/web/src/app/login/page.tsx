import { auth } from "@/auth";
import { LoginForm } from "./components/loginForm";
import { redirect } from "next/navigation";
import { getProviders } from "@/auth";
import { Footer } from "@/app/components/footer";

interface LoginProps {
    searchParams: {
        callbackUrl?: string;
        error?: string;
    }
}

export default async function Login({ searchParams }: LoginProps) {
    console.log("Login page loaded");
    const session = await auth();
    if (session) {
        console.log("Session found in login page, redirecting to home");
        return redirect("/");
    }

    const providers = getProviders();
    const providerMap = providers
        .map((provider) => {
            if (typeof provider === "function") {
                const providerData = provider()
                return { id: providerData.id, name: providerData.name }
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
                    enabledMethods={{
                        github: providerMap.some(provider => provider.id === "github"),
                        google: providerMap.some(provider => provider.id === "google"),
                        magicLink: providerMap.some(provider => provider.id === "nodemailer"),
                        credentials: providerMap.some(provider => provider.id === "credentials"),
                    }}
                />
            </div>
            <Footer />
        </div>
    )
}
