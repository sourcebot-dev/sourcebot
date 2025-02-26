'use client';

import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { githubQuickActions } from "../../connections/quickActions";
import SharedConnectionCreationForm from "./sharedConnectionCreationForm";

interface GitHubConnectionCreationFormProps {
    onCreated?: (id: number) => void;
}

export const GitHubConnectionCreationForm = ({ onCreated }: GitHubConnectionCreationFormProps) => {
    const defaultConfig: GithubConnectionConfig = {
        type: 'github',
    }

    return (
        <SharedConnectionCreationForm<GithubConnectionConfig>
            type="github"
            title="Create a GitHub connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
            }}
            schema={githubSchema}
            quickActions={githubQuickActions}
            onCreated={onCreated}
        />
    )
}