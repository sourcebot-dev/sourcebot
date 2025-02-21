import { completeOnboarding } from "@/actions";
import { OnboardingSteps } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { redirect } from "next/navigation";

interface CompleteOnboardingProps {
    searchParams: {
        stripe_session_id?: string;
    }
    params: {
        domain: string;
    }
}

export const CompleteOnboarding = async ({ searchParams, params: { domain } }: CompleteOnboardingProps) => {
    if (!searchParams.stripe_session_id) {
        return redirect(`/${domain}/onboard?step=${OnboardingSteps.Checkout}`);
    }
    const { stripe_session_id } = searchParams;

    const response = await completeOnboarding(stripe_session_id, domain);
    if (isServiceError(response)) {
        return redirect(`/${domain}/onboard?step=${OnboardingSteps.Checkout}&errorCode=${response.errorCode}&errorMessage=${response.message}`);
    }

    return redirect(`/${domain}`);
}