'use client';

import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { githubQuickActions } from "../../connections/quickActions";
import SharedConnectionCreationForm from "./sharedConnectionCreationForm";

interface GitHubConnectionCreationFormProps {
    onCreated?: (id: number) => void;
}

const additionalConfigValidation = (config: GithubConnectionConfig): { message: string, isValid: boolean } => {
    const hasRepos = config.repos && config.repos.length > 0;
    const hasOrgs = config.orgs && config.orgs.length > 0;
    const hasUsers = config.users && config.users.length > 0;

    if (!hasRepos && !hasOrgs && !hasUsers) {
        return {
            message: "At least one repository, organization, or user must be specified",
            isValid: false,
        }
    }

    return {
        message: "Valid",
        isValid: true,
    }
};

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
            additionalConfigValidation={additionalConfigValidation}
            quickActions={githubQuickActions}
            onCreated={onCreated}
        />
    )
}