'use client';

import Link from "next/link";
import { OnboardingSteps } from "@/lib/constants";
import useCaptureEvent from "@/hooks/useCaptureEvent";

interface SkipOnboardingButtonProps {
    currentStep: OnboardingSteps;
    lastRequiredStep: OnboardingSteps;
}

export const SkipOnboardingButton = ({ currentStep, lastRequiredStep }: SkipOnboardingButtonProps) => {
    const captureEvent = useCaptureEvent();

    const handleClick = () => {
        captureEvent('wa_onboard_skip_onboarding', {
            step: currentStep
        });
    };

    return (
        <Link
            className="text-sm text-muted-foreground underline cursor-pointer mt-12"
            href={`?step=${lastRequiredStep}`}
            onClick={handleClick}
        >
            Skip onboarding
        </Link>
    );
};
