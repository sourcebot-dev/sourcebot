import React from "react";
import { SettingsContainer } from "../components/settingsContainer";

export default function SkillsSettingsLayout({ children }: { children: React.ReactNode }) {
    return <SettingsContainer variant="full">{children}</SettingsContainer>;
}
