import { OrgCreateForm } from "./components/orgCreateForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OnboardHeader } from "./components/onboardHeader";
import { OnboardingSteps } from "@/lib/constants";
import { LogoutEscapeHatch } from "../components/logoutEscapeHatch";

export default async function Onboarding() {
    const session = await auth();
    if (!session) {
        redirect("/login");
    }

    return (
        <div className="flex flex-col items-center min-h-screen p-12 bg-backgroundSecondary fade-in-20 relative">
            <OnboardHeader
                title="Setup your organization"
                description="Create a organization for your team to search and share code across your repositories."
                step={OnboardingSteps.CreateOrg}
            />
            <OrgCreateForm />
            <LogoutEscapeHatch className="absolute top-0 right-0 p-12" />
        </div>
    );
}
