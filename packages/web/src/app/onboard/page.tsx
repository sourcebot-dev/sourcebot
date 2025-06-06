import { OrgCreateForm } from "./components/orgCreateForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OnboardHeader } from "./components/onboardHeader";
import { OnboardingSteps } from "@/lib/constants";
import { LogoutEscapeHatch } from "../components/logoutEscapeHatch";
import { headers } from "next/headers";

export default async function Onboarding() {
    const session = await auth();
    if (!session) {
        redirect("/login");
    }

    const host = (await headers()).get('host') ?? '';

    return (
        <div className="flex flex-col items-center min-h-screen py-12 px-4 sm:px-12 bg-backgroundSecondary relative">
            <OnboardHeader
                title="Setup your organization"
                description="Create a organization for your team to search and share code across your repositories."
                step={OnboardingSteps.CreateOrg}
            />
            <OrgCreateForm rootDomain={host} />
            <LogoutEscapeHatch className="absolute top-0 right-0 p-4 sm:p-12" />
        </div>
    );
}
