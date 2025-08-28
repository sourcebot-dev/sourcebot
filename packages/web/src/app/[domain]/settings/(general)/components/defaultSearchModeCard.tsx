'use client';

import { setDefaultSearchMode } from "@/actions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/loading-button";
import { OrgRole } from "@sourcebot/db";
import { MessageCircleIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/components/hooks/use-toast";

interface DefaultSearchModeCardProps {
    initialDefaultMode: "precise" | "agentic";
    currentUserRole: OrgRole;
    isAskModeAvailable: boolean;
}

export const DefaultSearchModeCard = ({ initialDefaultMode, currentUserRole, isAskModeAvailable }: DefaultSearchModeCardProps) => {
    const { domain } = useParams<{ domain: string }>();
    // If Ask mode is not available and the initial mode is agentic, force it to precise
    const effectiveInitialMode = !isAskModeAvailable && initialDefaultMode === "agentic" ? "precise" : initialDefaultMode;
    const [defaultSearchMode, setDefaultSearchModeState] = useState<"precise" | "agentic">(effectiveInitialMode);
    const [isUpdating, setIsUpdating] = useState(false);
    const isReadOnly = currentUserRole !== OrgRole.OWNER;
    const { toast } = useToast();

    const handleUpdateDefaultSearchMode = async () => {
        if (isReadOnly) {
            return;
        }

        setIsUpdating(true);
        try {
            const result = await setDefaultSearchMode(domain as string, defaultSearchMode);
            if (!result || typeof result !== 'object' || !result.success) {
                throw new Error('Failed to update default search mode');
            }
            toast({
                title: "Default search mode updated",
                description: `Default search mode has been set to ${defaultSearchMode === "agentic" ? "Ask" : "Code Search"}.`,
                variant: "success",
            });
        } catch (error) {
            console.error('Error updating default search mode:', error);
            toast({
                title: "Failed to update",
                description: "An error occurred while updating the default search mode.",
                variant: "destructive",
            });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Default Search Mode</CardTitle>
                <CardDescription>
                    Choose which search mode will be the default when users first visit Sourcebot
                    {!isAskModeAvailable && (
                        <span className="block text-yellow-600 dark:text-yellow-400 mt-1">
                            Ask mode is unavailable (no language models configured)
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Select
                    value={defaultSearchMode}
                    onValueChange={(value) => setDefaultSearchModeState(value as "precise" | "agentic")}
                    disabled={isReadOnly}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select default search mode">
                            {defaultSearchMode === "precise" ? "Code Search" : defaultSearchMode === "agentic" ? "Ask" : undefined}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="precise">Code Search</SelectItem>
                        <SelectItem value="agentic" disabled={!isAskModeAvailable}>
                            Ask {!isAskModeAvailable && "(unavailable)"}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </CardContent>
            <CardFooter>
                <LoadingButton
                    onClick={handleUpdateDefaultSearchMode}
                    loading={isUpdating}
                    disabled={isReadOnly || isUpdating || defaultSearchMode === effectiveInitialMode}
                >
                    Update
                </LoadingButton>
            </CardFooter>
        </Card>
    );
};