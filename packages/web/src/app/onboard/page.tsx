import { getAuthProviders } from "@/lib/authProviders";
import OnboardingPage from "./components/onboardingPage";

interface OnboardingProps {
    searchParams?: { step?: string };
}

export default async function Onboarding({ searchParams }: OnboardingProps) {
    const providers = getAuthProviders();
    return <OnboardingPage providers={providers} searchParams={searchParams} />
}
