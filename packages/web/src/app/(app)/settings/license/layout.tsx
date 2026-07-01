import React from "react";
import { SettingsContainer } from "../components/settingsContainer";

export default function LicenseSettingsLayout({ children }: { children: React.ReactNode }) {
    return <SettingsContainer>{children}</SettingsContainer>;
}
