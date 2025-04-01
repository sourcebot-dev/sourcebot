'use client';

import { GerritConnectionConfig } from "@sourcebot/schemas/v3/gerrit.type";
import { gerritSchema } from "@sourcebot/schemas/v3/gerrit.schema";
import { gerritQuickActions } from "../../connections/quickActions";
import SharedConnectionCreationForm from "./sharedConnectionCreationForm";

interface GerritConnectionCreationFormProps {
    onCreated?: (id: number) => void;
}

const additionalConfigValidation = (config: GerritConnectionConfig): { message: string, isValid: boolean } => {
    const hasProjects = config.projects && config.projects.length > 0;

    if (!hasProjects) {
        return {
            message: "At least one project must be specified",
            isValid: false,
        }
    }

    return {
        message: "Valid",
        isValid: true,
    }
}

export const GerritConnectionCreationForm = ({ onCreated }: GerritConnectionCreationFormProps) => {
    const defaultConfig: GerritConnectionConfig = {
        type: 'gerrit',
        url: "https://gerrit.example.com"
    }

    return (
        <SharedConnectionCreationForm<GerritConnectionConfig>
            type="gerrit"
            title="Create a Gerrit connection"
            defaultValues={{
                config: JSON.stringify(defaultConfig, null, 2),
            }}
            schema={gerritSchema}
            quickActions={gerritQuickActions}
            additionalConfigValidation={additionalConfigValidation}
            onCreated={onCreated}
        />
    )
} 