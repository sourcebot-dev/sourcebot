import { getProviders } from "@/auth";
import OnboardingPage from "./components/onboardingPage";

interface OnboardingProps {
    searchParams?: { step?: string };
}

export default async function Onboarding({ searchParams }: OnboardingProps) {
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
        
    return <OnboardingPage providers={providerData} searchParams={searchParams} />
}
