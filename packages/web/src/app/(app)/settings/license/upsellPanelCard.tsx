"use client";

import { SettingsCard } from "../components/settingsCard";
import { UpsellPanel } from "@/ee/features/lighthouse/upsellDialog";

export function UpsellPanelCard() {
    return (
        <SettingsCard>
            <UpsellPanel
                source="license_settings"
                returnPath="/settings/license"
            />
        </SettingsCard>
    );
}
