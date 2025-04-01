'use client';

import { completeOnboarding } from "@/actions";
import { OnboardingSteps } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDomain } from "@/hooks/useDomain";

export const CompleteOnboarding = () => {
    const router = useRouter();
    const domain = useDomain();

    useEffect(() => {
        const complete = async () => {
            const response = await completeOnboarding(domain);
            if (isServiceError(response)) {
                router.push(`/${domain}/onboard?step=${OnboardingSteps.Checkout}&errorCode=${response.errorCode}&errorMessage=${response.message}`);
                return;
            }

            router.push(`/${domain}`);
            router.refresh();
        };

        complete();
    }, [domain, router]);

    return null;
}