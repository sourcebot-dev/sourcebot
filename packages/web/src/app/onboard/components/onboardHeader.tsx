import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { OnboardingSteps } from "@/lib/constants";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";

interface OnboardHeaderProps {
    title: string
    description: string
    step: OnboardingSteps
}

export const OnboardHeader = ({ title, description, step: currentStep }: OnboardHeaderProps) => {
    const steps = Object.values(OnboardingSteps)
        .filter(s => s !== OnboardingSteps.Complete)
        .filter(s => !IS_BILLING_ENABLED ? s !== OnboardingSteps.Checkout : true);

    return (
        <div className="flex flex-col items-center text-center mb-10">
            <SourcebotLogo
                className="h-16 mb-2"
                size="large"
            />
            <h1 className="text-3xl font-bold mb-3">
                {title}
            </h1>
            <p className="text-sm text-muted-foreground mb-5">
                {description}
            </p>
            <div className="flex justify-center gap-2">
                {steps.map((step, index) => (
                    <div
                        key={index}
                        className={`h-1.5 w-6 rounded-full transition-colors ${step === currentStep ? "bg-gray-400" : "bg-gray-200"}`}
                    />
                ))}
            </div>
        </div>
    )
}