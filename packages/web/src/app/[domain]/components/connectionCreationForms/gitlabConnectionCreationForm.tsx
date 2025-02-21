'use client';

import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";
import { gitlabQuickActions } from "../../connections/quickActions";
import SharedConnectionCreationForm from "./sharedConnectionCreationForm";

interface GitLabConnectionCreationFormProps {
    onCreated?: (id: number) => void;
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
                name: 'my-gitlab-connection',
            }}
            schema={gitlabSchema}
            quickActions={gitlabQuickActions}
            onCreated={onCreated}
        />
    )
} 