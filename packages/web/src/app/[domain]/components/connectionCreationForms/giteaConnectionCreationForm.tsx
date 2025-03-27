'use client';

import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/gitea.type";
import { giteaSchema } from "@sourcebot/schemas/v3/gitea.schema";
import { giteaQuickActions } from "../../connections/quickActions";
import SharedConnectionCreationForm from "./sharedConnectionCreationForm";

interface GiteaConnectionCreationFormProps {
    onCreated?: (id: number) => void;
}

const additionalConfigValidation = (config: GiteaConnectionConfig): { message: string, isValid: boolean } => {
    const hasOrgs = config.orgs && config.orgs.length > 0 && config.orgs.some(o => o.trim().length > 0);
    const hasUsers = config.users && config.users.length > 0 && config.users.some(u => u.trim().length > 0);
    const hasRepos = config.repos && config.repos.length > 0 && config.repos.some(r => r.trim().length > 0);

    if (!hasOrgs && !hasUsers && !hasRepos) {
        return {
            message: "At least one organization, user, or repository must be specified",
            isValid: false,
        }
    }

    return {
        message: "Valid",
        isValid: true,
    }
}

export const GiteaConnectionCreationForm = ({ onCreated }: GiteaConnectionCreationFormProps) => {
    const defaultConfig: GiteaConnectionConfig = {
        type: 'gitea',
    }

    return (
        <SharedConnectionCreationForm<GiteaConnectionConfig>
            type="gitea"
            title="Create a Gitea connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
            }}
            schema={giteaSchema}
            quickActions={giteaQuickActions}
            additionalConfigValidation={additionalConfigValidation}
            onCreated={onCreated}
        />
    )
} 