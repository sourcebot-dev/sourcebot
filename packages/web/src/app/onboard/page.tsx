import { OrgCreateForm } from "./components/orgCreateForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OnboardHeader } from "./components/onboardHeader";
import { OnboardingSteps } from "@/lib/constants";

export default async function Onboarding() {
    const session = await auth();
    if (!session) {
        redirect("/login");
    }

    return (
        <div className="flex flex-col items-center min-h-screen p-12 bg-backgroundSecondary fade-in-20">
            <OnboardHeader
                title="Setup your organization"
                description="Create a organization for your team to search and share code across your repositories."
                step={OnboardingSteps.CreateOrg}
            />
            <OrgCreateForm />
        </div>
    );
}
