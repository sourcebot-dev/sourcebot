import React from "react";
import { SettingsContainer } from "../components/settingsContainer";

export default function SecuritySettingsLayout({ children }: { children: React.ReactNode }) {
    return <SettingsContainer>{children}</SettingsContainer>;
}
