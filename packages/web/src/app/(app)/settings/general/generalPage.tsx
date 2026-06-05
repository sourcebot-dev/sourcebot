'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/userAvatar";
import { HomeView, useHomeView } from "@/hooks/useHomeView";
import { useKeymapType } from "@/hooks/useKeymapType";
import { KeymapType } from "@/lib/types";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { BasicSettingsCard, SettingsCard, SettingsCardGroup } from "../components/settingsCard";

const themeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
] as const;

const homeViewOptions = [
    { value: "search", label: "Code Search" },
    { value: "ask", label: "Ask" },
] as const;

const keymapOptions = [
    { value: "default", label: "Standard" },
    { value: "vim", label: "Vim" },
] as const;

interface GeneralPageProps {
    userName?: string;
    userEmail?: string;
    userImage?: string;
}

export function GeneralPage({ userName, userEmail, userImage }: GeneralPageProps) {
    const { theme: _theme, setTheme } = useTheme();
    const [homeView, setHomeView] = useHomeView();
    const [keymapType, setKeymapType] = useKeymapType();

    const theme = useMemo(() => {
        return _theme ?? "light";
    }, [_theme]);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">General</h3>
                <p className="text-sm text-muted-foreground">
                    Manage your profile and preferences.
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium text-muted-foreground">Profile</h4>
                <SettingsCard>
                    <div className="flex items-center gap-4">
                        <UserAvatar
                            email={userEmail}
                            imageUrl={userImage}
                            className="h-12 w-12"
                        />
                        <div className="flex flex-col">
                            <span className="font-medium">{userName ?? "User"}</span>
                            {userEmail && (
                                <span className="text-sm text-muted-foreground">{userEmail}</span>
                            )}
                        </div>
                    </div>
                </SettingsCard>
            </div>

            <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium text-muted-foreground">Preferences</h4>
                <SettingsCardGroup>
                    <BasicSettingsCard name="Default home view" description="Choose which page to show when you open Sourcebot.">
                        <Select value={homeView} onValueChange={(value) => setHomeView(value as HomeView)}>
                            <SelectTrigger className="w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {homeViewOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </BasicSettingsCard>
                    <BasicSettingsCard name="Appearance" description="Choose how Sourcebot looks to you.">
                        <Select value={theme} onValueChange={setTheme}>
                            <SelectTrigger className="w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {themeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </BasicSettingsCard>
                    <BasicSettingsCard name="Editor keymap" description="Choose the keyboard shortcuts used in the code viewer.">
                        <Select value={keymapType} onValueChange={(value) => setKeymapType(value as KeymapType)}>
                            <SelectTrigger className="w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {keymapOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </BasicSettingsCard>
                </SettingsCardGroup>
            </div>
        </div>
    );
}
