import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ConfigureOrgStepProps {
    nextStep: number;
}

export function ConfigureOrgStep({ nextStep }: ConfigureOrgStepProps) {
    return (
        <div className="space-y-6">
            <Button asChild className="w-full">
                <Link href={`/onboard?step=${nextStep}`}>Continue →</Link>
            </Button>
        </div>
    );
}
