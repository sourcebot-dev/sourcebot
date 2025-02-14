"use client";

import { useState, useEffect} from "react";
import { OrgCreateForm, OnboardingFormValues } from "./components/orgCreateForm";
import { TrialCard } from "./components/trialInfoCard";
import { isAuthed } from "@/actions";
import { useRouter } from "next/navigation";

export default function Onboarding() {
    const router = useRouter();
    const [orgCreateInfo, setOrgInfo] = useState<OnboardingFormValues | undefined>(undefined);

    useEffect(() => {
        const redirectIfNotAuthed = async () => {
            const authed = await isAuthed();
            if(!authed) {
                router.push("/login");
            }
        }

        redirectIfNotAuthed();
    }, [router]);

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
