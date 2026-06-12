import { AuthMethodSelector } from "@/app/components/authMethodSelector";

interface OwnerSignupStepProps {
    nextStep: number;
}

export function OwnerSignupStep({ nextStep }: OwnerSignupStepProps) {
    return (
        <div className="space-y-6">
            <AuthMethodSelector
                callbackUrl={`/onboard?step=${nextStep}`}
                context="signup"
                securityNoticeClosable={false}
            />
        </div>
    );
}
