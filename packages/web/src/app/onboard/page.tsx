"use client";

import { useState } from "react";
import { OrgCreateForm, OnboardingFormValues } from "./components/orgCreateForm";
import { TrialCard } from "./components/trialInfoCard";

export default function Onboarding() {
    const [orgCreateInfo, setOrgInfo] = useState<OnboardingFormValues | undefined>(undefined);

    return (
        <div className="flex flex-col justify-center items-center h-screen">
            {orgCreateInfo ? (
                <TrialCard orgCreateInfo={ orgCreateInfo } />
            ) : (
                <div className="flex flex-col items-center border p-16 rounded-lg gap-6">
                    <OrgCreateForm setOrgCreateData={setOrgInfo} />
                </div>
            )}
        </div>
    );
}