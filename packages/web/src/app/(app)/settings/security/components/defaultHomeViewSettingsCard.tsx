"use client";

import { BasicSettingsCard } from "@/app/(app)/settings/components/settingsCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { type HomeView } from "@/features/homeView/homeView";
import { isServiceError } from "@/lib/utils";
import { useState } from "react";
import { setDefaultHomeView } from "../actions";

const homeViewOptions = [
    { value: "search", label: "Code Search" },
    { value: "ask", label: "Ask" },
] as const;

interface DefaultHomeViewSettingsCardProps {
    defaultHomeView: HomeView;
}

export function DefaultHomeViewSettingsCard({ defaultHomeView }: DefaultHomeViewSettingsCardProps) {
    const [homeView, setHomeView] = useState(defaultHomeView);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleChange = async (value: string) => {
        if (value !== "search" && value !== "ask") {
            return;
        }

        setIsSaving(true);
        try {
            const result = await setDefaultHomeView(value);
            if (isServiceError(result)) {
                toast({
                    title: "Error",
                    description: result.message,
                    variant: "destructive",
                });
                return;
            }

            setHomeView(value);
            toast({ description: "Deployment default home view saved." });
        } catch {
            toast({
                title: "Error",
                description: "Failed to update the deployment default home view.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <BasicSettingsCard
            name="Deployment default home view"
            description="Choose the default page for users without a personal preference. Individual user preferences override this setting."
        >
            <Select value={homeView} onValueChange={handleChange} disabled={isSaving}>
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
    );
}
