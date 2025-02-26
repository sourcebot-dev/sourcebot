'use client';

import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/gitea.type";
import { giteaSchema } from "@sourcebot/schemas/v3/gitea.schema";
import { giteaQuickActions } from "../../connections/quickActions";
import SharedConnectionCreationForm from "./sharedConnectionCreationForm";

interface GiteaConnectionCreationFormProps {
    onCreated?: (id: number) => void;
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
            onCreated={onCreated}
        />
    )
} 