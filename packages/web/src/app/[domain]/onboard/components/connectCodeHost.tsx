'use client';

import { useEffect, useState } from "react";
import { CodeHostType } from "@/lib/utils";
import { getCodeHostIcon } from "@/lib/utils";
import {
    GitHubConnectionCreationForm,
    GitLabConnectionCreationForm,
    GiteaConnectionCreationForm,
    GerritConnectionCreationForm
} from "@/app/[domain]/components/connectionCreationForms";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { OnboardingSteps } from "@/lib/constants";
import { BackButton } from "./onboardBackButton";
import { CodeHostIconButton } from "../../components/codeHostIconButton";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import SecurityCard from "@/app/components/securityCard";

interface ConnectCodeHostProps {
    nextStep: OnboardingSteps;
}

export const ConnectCodeHost = ({ nextStep }: ConnectCodeHostProps) => {
    const [selectedCodeHost, setSelectedCodeHost] = useState<CodeHostType | null>(null);
    const router = useRouter();
    const { data: session } = useSession();

    // Note: this is currently the first client side page that gets loaded after a user registers. If this changes, we need to update this.
    // @nocheckin
    useEffect(() => {
        if (session?.user) {
            posthog.identify(session.user.id, {
                email: session.user.email,
                name: session.user.name,
            });
        }
    }, [session?.user]);

    const onCreated = useCallback(() => {
        router.push(`?step=${nextStep}`);
    }, [nextStep, router]);

    const onBack = useCallback(() => {
        setSelectedCodeHost(null);
    }, []);

    if (!selectedCodeHost) {
        return (
            <>
                <CodeHostSelection onSelect={setSelectedCodeHost} />
                <SecurityCard />
            </>
        )
    }

    if (selectedCodeHost === "github") {
        return (
            <>
                <BackButton onClick={onBack} />
                <GitHubConnectionCreationForm onCreated={onCreated} />
            </>
        )
    }

    if (selectedCodeHost === "gitlab") {
        return (
            <>
                <BackButton onClick={onBack} />
                <GitLabConnectionCreationForm onCreated={onCreated} />
            </>
        )
    }

    if (selectedCodeHost === "gitea") {
        return (
            <>
                <BackButton onClick={onBack} />
                <GiteaConnectionCreationForm onCreated={onCreated} />
            </>
        )
    }

    if (selectedCodeHost === "gerrit") {
        return (
            <>
                <BackButton onClick={onBack} />
                <GerritConnectionCreationForm onCreated={onCreated} />
            </>
        )
    }

    return null;
}

interface CodeHostSelectionProps {
    onSelect: (codeHost: CodeHostType) => void;
}

const CodeHostSelection = ({ onSelect }: CodeHostSelectionProps) => {
    const captureEvent = useCaptureEvent();

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <CodeHostIconButton
                name="GitHub"
                logo={getCodeHostIcon("github")!}
                onClick={() => {
                    onSelect("github");
                    captureEvent("wa_onboard_github_selected", {});
                }}
            />
            <CodeHostIconButton
                name="GitLab"
                logo={getCodeHostIcon("gitlab")!}
                onClick={() => {
                    onSelect("gitlab");
                    captureEvent("wa_onboard_gitlab_selected", {});
                }}
            />
            <CodeHostIconButton
                name="Gitea"
                logo={getCodeHostIcon("gitea")!}
                onClick={() => {
                    onSelect("gitea");
                    captureEvent("wa_onboard_gitea_selected", {});
                }}
            />
            <CodeHostIconButton
                name="Gerrit"
                logo={getCodeHostIcon("gerrit")!}
                onClick={() => {
                    onSelect("gerrit");
                    captureEvent("wa_onboard_gerrit_selected", {});
                }}
            />
        </div>
    )
}
