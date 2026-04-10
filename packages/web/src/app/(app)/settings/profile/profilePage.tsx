'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useKeymapType } from "@/hooks/useKeymapType";
import { KeymapType } from "@/lib/types";
import { Laptop, Moon, Sun, Terminal, TextCursor } from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { BasicSettingsCard, SettingsCardGroup } from "../components/settingsCard";

const themeOptions = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
] as const;

const keymapOptions = [
    { value: "default", label: "Standard", icon: TextCursor },
    { value: "vim", label: "Vim", icon: Terminal },
] as const;

export function ProfilePage() {
    const { theme: _theme, setTheme } = useTheme();
    const [keymapType, setKeymapType] = useKeymapType();

    const theme = useMemo(() => {
        return _theme ?? "light";
    }, [_theme]);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Profile</h3>
                <p className="text-sm text-muted-foreground">
                    Manage your account preferences and profile settings.
                </p>
            </div>
            <SettingsCardGroup>
                <BasicSettingsCard name="Appearance" description="Choose how Sourcebot looks to you.">
                    <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger className="w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {themeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                        <option.icon className="h-3 w-3" />
                                        <span>{option.label}</span>
                                    </div>
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
                                    <div className="flex items-center gap-2">
                                        <option.icon className="h-3 w-3" />
                                        <span>{option.label}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </BasicSettingsCard>
            </SettingsCardGroup>
        </div>
    );
}
