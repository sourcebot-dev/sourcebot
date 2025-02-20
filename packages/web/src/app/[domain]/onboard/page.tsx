import { OnboardHeader } from "@/app/onboard/components/onboardHeader";
import { getOrgFromDomain } from "@/data/org";
import { OnboardingSteps } from "@/lib/constants";
import { notFound, redirect } from "next/navigation";
import { ConnectCodeHost } from "./components/connectCodeHost";
import { InviteTeam } from "./components/inviteTeam";
import Link from "next/link";
import { CompleteOnboarding } from "./components/completeOnboarding";
import { Checkout } from "./components/checkout";
import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch";

interface OnboardProps {
    params: {
        domain: string
    },
    searchParams: {
        step?: string
        stripe_session_id?: string
    }
}

export default async function Onboard({ params, searchParams }: OnboardProps) {
    const org = await getOrgFromDomain(params.domain);
    if (!org) {
        notFound();
    }

    if (org.isOnboarded) {
        redirect(`/${params.domain}`);
    }

    const step = searchParams.step ?? OnboardingSteps.ConnectCodeHost;
    if (
        !Object.values(OnboardingSteps)
            .filter(s => s !== OnboardingSteps.CreateOrg)
            .map(s => s.toString())
            .includes(step)
    ) {
        redirect(`/${params.domain}/onboard?step=${OnboardingSteps.ConnectCodeHost}`);
    }

    const lastRequiredStep = OnboardingSteps.Checkout;

    return (
        <div className="flex flex-col items-center p-12 min-h-screen bg-backgroundSecondary relative">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-12" />
            {step === OnboardingSteps.ConnectCodeHost && (
                <>
                    <OnboardHeader
                        title="Connect your code host"
                        description="Connect your code host to start searching your code."
                        step={step as OnboardingSteps}
                    />
                    <ConnectCodeHost
                        nextStep={OnboardingSteps.InviteTeam}
                    />
                    <Link
                        className="text-sm text-muted-foreground underline cursor-pointer mt-12"
                        href={`?step=${lastRequiredStep}`}
                    >
                        Skip onboarding
                    </Link>
                </>
            )}
            {step === OnboardingSteps.InviteTeam && (
                <>
                    <OnboardHeader
                        title="Invite your team"
                        description="Invite your team to get the most out of Sourcebot."
                        step={step as OnboardingSteps}
                    />
                    <InviteTeam
                        nextStep={lastRequiredStep}
                    />
                </>
            )}
            {step === OnboardingSteps.Checkout && (
                <>
                    <Checkout />
                </>
            )}
            {step === OnboardingSteps.Complete && (
                <CompleteOnboarding
                    searchParams={searchParams}
                    params={params}
                />
            )}
        </div>
    )
}