'use client';

import SharedConnectionCreationForm from "./sharedConnectionCreationForm";
import { BitbucketConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { bitbucketSchema } from "@sourcebot/schemas/v3/bitbucket.schema";
import { bitbucketDataCenterQuickActions } from "../../connections/quickActions";

interface BitbucketDataCenterConnectionCreationFormProps {
    onCreated?: (id: number) => void;
}

const additionalConfigValidation = (config: BitbucketConnectionConfig): { message: string, isValid: boolean } => {
    const hasProjects = config.projects && config.projects.length > 0 && config.projects.some(p => p.trim().length > 0);
    const hasRepos = config.repos && config.repos.length > 0 && config.repos.some(r => r.trim().length > 0);

    if (!hasProjects && !hasRepos) {
        return {
            message: "At least one project or repository must be specified",
            isValid: false,
        }
    }

    return {
        message: "Valid",
        isValid: true,
    }
};

export const BitbucketDataCenterConnectionCreationForm = ({ onCreated }: BitbucketDataCenterConnectionCreationFormProps) => {
    const defaultConfig: BitbucketConnectionConfig = {
        type: 'bitbucket',
        deploymentType: 'server',
    }

    return (
        <SharedConnectionCreationForm<BitbucketConnectionConfig>
            type="bitbucket"
            title="Create a Bitbucket Data Center connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
            }}
            schema={bitbucketSchema}
            additionalConfigValidation={additionalConfigValidation}
            quickActions={bitbucketDataCenterQuickActions}
            onCreated={onCreated}
        />
    )
}