'use client';

import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";
import { gitlabQuickActions } from "../../connections/quickActions";
import SharedConnectionCreationForm from "./sharedConnectionCreationForm";

interface GitLabConnectionCreationFormProps {
    onCreated?: (id: number) => void;
}

const additionalConfigValidation = (config: GitlabConnectionConfig): { message: string, isValid: boolean } => {
    const hasProjects = config.projects && config.projects.length > 0 && config.projects.some(p => p.trim().length > 0);
    const hasUsers = config.users && config.users.length > 0 && config.users.some(u => u.trim().length > 0); 
    const hasGroups = config.groups && config.groups.length > 0 && config.groups.some(g => g.trim().length > 0);

    if (!hasProjects && !hasUsers && !hasGroups) {
        return {
            message: "At least one project, user, or group must be specified",
            isValid: false,
        }
    }

    return {
        message: "Valid",
        isValid: true,
    }
}

export const GitLabConnectionCreationForm = ({ onCreated }: GitLabConnectionCreationFormProps) => {
    const defaultConfig: GitlabConnectionConfig = {
        type: 'gitlab',
    }

    return (
        <SharedConnectionCreationForm<GitlabConnectionConfig>
            type="gitlab"
            title="Create a GitLab connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
            }}
            schema={gitlabSchema}
            quickActions={gitlabQuickActions}
            additionalConfigValidation={additionalConfigValidation}
            onCreated={onCreated}
        />
    )
} 