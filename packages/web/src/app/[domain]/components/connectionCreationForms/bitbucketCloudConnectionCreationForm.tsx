'use client';

import SharedConnectionCreationForm from "./sharedConnectionCreationForm";
import { BitbucketConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { bitbucketSchema } from "@sourcebot/schemas/v3/bitbucket.schema";
import { bitbucketCloudQuickActions } from "../../connections/quickActions";

interface BitbucketCloudConnectionCreationFormProps {
    onCreated?: (id: number) => void;
}

const additionalConfigValidation = (config: BitbucketConnectionConfig): { message: string, isValid: boolean } => {
    const hasProjects = config.projects && config.projects.length > 0 && config.projects.some(p => p.trim().length > 0);
    const hasRepos = config.repos && config.repos.length > 0 && config.repos.some(r => r.trim().length > 0);
    const hasWorkspaces = config.workspaces && config.workspaces.length > 0 && config.workspaces.some(w => w.trim().length > 0);

    if (!hasProjects && !hasRepos && !hasWorkspaces) {
        return {
            message: "At least one project, repository, or workspace must be specified",
            isValid: false,
        }
    }

    return {
        message: "Valid",
        isValid: true,
    }
};

export const BitbucketCloudConnectionCreationForm = ({ onCreated }: BitbucketCloudConnectionCreationFormProps) => {
    const defaultConfig: BitbucketConnectionConfig = {
        type: 'bitbucket',
        deploymentType: 'cloud',
    }

    return (
        <SharedConnectionCreationForm<BitbucketConnectionConfig>
            type="bitbucket-cloud"
            title="Create a Bitbucket Cloud connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
            }}
            schema={bitbucketSchema}
            additionalConfigValidation={additionalConfigValidation}
            quickActions={bitbucketCloudQuickActions}
            onCreated={onCreated}
        />
    )
}