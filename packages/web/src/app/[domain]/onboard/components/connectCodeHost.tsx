'use client';

import Image from "next/image";
import { useState } from "react";
import { cn, CodeHostType } from "@/lib/utils";
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
import { Button } from "@/components/ui/button";
import useCaptureEvent from "@/hooks/useCaptureEvent";
interface ConnectCodeHostProps {
    nextStep: OnboardingSteps;
}

export const ConnectCodeHost = ({ nextStep }: ConnectCodeHostProps) => {
    const [selectedCodeHost, setSelectedCodeHost] = useState<CodeHostType | null>(null);
    const router = useRouter();
    const onCreated = useCallback(() => {
        router.push(`?step=${nextStep}`);
    }, [nextStep, router]);

    if (!selectedCodeHost) {
        return (
            <CodeHostSelection onSelect={setSelectedCodeHost} />
        )
    }

    if (selectedCodeHost === "github") {
        return (
            <GitHubConnectionCreationForm onCreated={onCreated} />
        )
    }

    if (selectedCodeHost === "gitlab") {
        return (
            <GitLabConnectionCreationForm onCreated={onCreated} />
        )
    }

    if (selectedCodeHost === "gitea") {
        return (
            <GiteaConnectionCreationForm onCreated={onCreated} />
        )
    }

    if (selectedCodeHost === "gerrit") {
        return (
            <GerritConnectionCreationForm onCreated={onCreated} />
        )
    }

    return null;
}

interface CodeHostSelectionProps {
    onSelect: (codeHost: CodeHostType) => void;
}

const CodeHostSelection = ({ onSelect }: CodeHostSelectionProps) => {
    return (
        <div className="flex flex-row gap-4">
            <CodeHostButton
                name="GitHub"
                logo={getCodeHostIcon("github")!}
                onClick={() => onSelect("github")}
            />
            <CodeHostButton
                name="GitLab"
                logo={getCodeHostIcon("gitlab")!}
                onClick={() => onSelect("gitlab")}
            />
            <CodeHostButton
                name="Gitea"
                logo={getCodeHostIcon("gitea")!}
                onClick={() => onSelect("gitea")}
            />
            <CodeHostButton
                name="Gerrit"
                logo={getCodeHostIcon("gerrit")!}
                onClick={() => onSelect("gerrit")}
            />
        </div>
    )
}

interface CodeHostButtonProps {
    name: string;
    logo: { src: string, className?: string };
    onClick: () => void;
}

const CodeHostButton = ({
    name,
    logo,
    onClick,
}: CodeHostButtonProps) => {
    const captureEvent = useCaptureEvent();
    return (
        <Button
            className="flex flex-col items-center justify-center p-4 w-24 h-24 cursor-pointer gap-2"
            variant="outline"
            onClick={() => {
                captureEvent('wa_connect_code_host_button_pressed', {
                    name,
                })
                onClick();
            }}
        >
            <Image src={logo.src} alt={name} className={cn("w-8 h-8", logo.className)} />
            <p className="text-sm font-medium">{name}</p>
        </Button>
    )
}