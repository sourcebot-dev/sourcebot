import Link from "next/link";
import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
    nextStep: number;
}

export function WelcomeStep({ nextStep }: WelcomeStepProps) {
    return (
        <div className="space-y-6">
            <Button asChild className="w-full">
                <Link href={`/onboard?step=${nextStep}`}>Get Started →</Link>
            </Button>
        </div>
    );
}
