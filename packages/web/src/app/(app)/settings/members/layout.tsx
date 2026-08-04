import React from "react";
import { SettingsContainer } from "../components/settingsContainer";

/**
 * Members uses the full-width variant of `SettingsContainer` rather than the
 * default centered column: the member table is dense and benefits from the full
 * viewport width.
 */
export default function MembersSettingsLayout({ children }: { children: React.ReactNode }) {
    return <SettingsContainer variant="full">{children}</SettingsContainer>;
}
