'use client';

import { useState } from "react";
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

interface ConnectCodeHostProps {
    nextStep: OnboardingSteps;
}

export const ConnectCodeHost = ({ nextStep }: ConnectCodeHostProps) => {
    const [selectedCodeHost, setSelectedCodeHost] = useState<CodeHostType | null>(null);
    const router = useRouter();
    const onCreated = useCallback(() => {
        router.push(`?step=${nextStep}`);
    }, [nextStep, router]);

    const onBack = useCallback(() => {
        setSelectedCodeHost(null);
    }, []);

    if (!selectedCodeHost) {
        return (
            <CodeHostSelection onSelect={setSelectedCodeHost} />
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
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <CodeHostIconButton
                name="GitHub"
                logo={getCodeHostIcon("github")!}
                onClick={() => onSelect("github")}
            />
            <CodeHostIconButton
                name="GitLab"
                logo={getCodeHostIcon("gitlab")!}
                onClick={() => onSelect("gitlab")}
            />
            <CodeHostIconButton
                name="Gitea"
                logo={getCodeHostIcon("gitea")!}
                onClick={() => onSelect("gitea")}
            />
            <CodeHostIconButton
                name="Gerrit"
                logo={getCodeHostIcon("gerrit")!}
                onClick={() => onSelect("gerrit")}
            />
        </div>
    )
}
