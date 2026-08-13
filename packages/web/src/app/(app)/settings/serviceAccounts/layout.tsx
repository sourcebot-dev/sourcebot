import React from "react";
import { SettingsContainer } from "../components/settingsContainer";

export default function ServiceAccountsSettingsLayout({ children }: { children: React.ReactNode }) {
    return <SettingsContainer variant="full">{children}</SettingsContainer>;
}
