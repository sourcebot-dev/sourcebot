'use client';

import { useToast } from "@/components/hooks/use-toast";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { updateChatPreferences } from "@/features/chat/actions";
import {
    CHAT_CUSTOM_INSTRUCTIONS_MAX_LENGTH,
    CHAT_PREFERENCE_SPEC,
    ChatPreferenceDimension,
    ChatPreferences,
    VISIBLE_CHAT_PREFERENCE_DIMENSIONS,
} from "@/features/chat/userPreferences";
import { isServiceError } from "@/lib/utils";
import { useCallback, useMemo, useState } from "react";

interface ChatPreferencesPageProps {
    initialPreferences: ChatPreferences;
    initialCustomInstructions: string | null;
}

export function ChatPreferencesPage({
    initialPreferences,
    initialCustomInstructions,
}: ChatPreferencesPageProps) {
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();

    const [preferences, setPreferences] = useState<ChatPreferences>(initialPreferences);
    const [customInstructions, setCustomInstructions] = useState<string>(initialCustomInstructions ?? "");
    const [isSaving, setIsSaving] = useState(false);

    // Compare current form state against the last-saved baseline to enable/disable
    // the save button and reset link.
    const [savedSnapshot, setSavedSnapshot] = useState({
        preferences: initialPreferences,
        customInstructions: initialCustomInstructions ?? "",
    });

    const hasUnsavedChanges = useMemo(() => {
        if (customInstructions !== savedSnapshot.customInstructions) {
            return true;
        }
        const currentKeys = Object.keys(preferences) as ChatPreferenceDimension[];
        const savedKeys = Object.keys(savedSnapshot.preferences) as ChatPreferenceDimension[];
        if (currentKeys.length !== savedKeys.length) {
            return true;
        }
        for (const k of currentKeys) {
            if (preferences[k] !== savedSnapshot.preferences[k]) {
                return true;
            }
        }
        return false;
    }, [preferences, customInstructions, savedSnapshot]);

    const isOverLimit = customInstructions.length > CHAT_CUSTOM_INSTRUCTIONS_MAX_LENGTH;

    const handleDimensionChange = useCallback((dimension: ChatPreferenceDimension, value: string) => {
        setPreferences((prev) => {
            const next: Record<string, string> = { ...prev };
            if (value === "") {
                delete next[dimension];
            } else {
                // The string value originates from a ToggleGroupItem whose `value`
                // attribute is one of this dimension's level values; the write
                // path then validates the full object against `chatPreferencesSchema`.
                next[dimension] = value;
            }
            return next as ChatPreferences;
        });
    }, []);

    const handleReset = useCallback(() => {
        setPreferences(savedSnapshot.preferences);
        setCustomInstructions(savedSnapshot.customInstructions);
    }, [savedSnapshot]);

    const handleSave = useCallback(async () => {
        if (isOverLimit) {
            return;
        }

        setIsSaving(true);
        try {
            const trimmedCustom = customInstructions.trim();
            const result = await updateChatPreferences({
                preferences,
                customInstructions: trimmedCustom.length > 0 ? trimmedCustom : null,
            });

            if (isServiceError(result)) {
                toast({
                    title: "Failed to save chat preferences",
                    description: result.message,
                    variant: "destructive",
                });
                return;
            }

            setSavedSnapshot({
                preferences,
                customInstructions,
            });
            captureEvent("wa_chat_preferences_saved", {
                dimensionsSet: Object.keys(preferences).length,
                hasCustomInstructions: trimmedCustom.length > 0,
                customInstructionsLength: trimmedCustom.length,
            });
            toast({
                title: "Chat preferences saved",
                description: "Sourcebot will apply these to future chats.",
            });
        } catch (error) {
            toast({
                title: "Failed to save chat preferences",
                description: error instanceof Error ? error.message : String(error),
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    }, [preferences, customInstructions, isOverLimit, toast, captureEvent]);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h3 className="text-lg font-medium">Chat Preferences</h3>
                <p className="text-sm text-muted-foreground max-w-xl">
                    Tune how Sourcebot writes its answers. These preferences are applied as soft
                    biases to every chat you start. They never override the explicit content of
                    your message, and you can leave any row unset to keep the default behavior.
                </p>
            </div>

            <div className="flex flex-col gap-6">
                {VISIBLE_CHAT_PREFERENCE_DIMENSIONS.map((dimension) => {
                    const spec = CHAT_PREFERENCE_SPEC[dimension];
                    const currentValue = preferences[dimension] ?? "";
                    return (
                        <div key={dimension} className="flex flex-col gap-2">
                            <div>
                                <h4 className="text-sm font-medium">{spec.label}</h4>
                                <p className="text-sm text-muted-foreground">
                                    {spec.description}
                                </p>
                            </div>
                            <ToggleGroup
                                type="single"
                                value={currentValue}
                                onValueChange={(value) => handleDimensionChange(dimension, value)}
                                variant="outline"
                                className="flex-wrap justify-start gap-2"
                                aria-label={spec.label}
                            >
                                {spec.levels.map((level) => (
                                    <ToggleGroupItem
                                        key={level.value}
                                        value={level.value}
                                        aria-label={`${spec.label}: ${level.label}`}
                                        className="h-9 w-auto min-w-0 px-3"
                                    >
                                        {level.label}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        </div>
                    );
                })}

                <div className="flex flex-col gap-2">
                    <div>
                        <h4 className="text-sm font-medium">Custom instructions</h4>
                        <p className="text-sm text-muted-foreground">
                            Anything else you want Sourcebot to keep in mind when answering.
                            Used as soft guidance, never as an override.
                        </p>
                    </div>
                    <Textarea
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder={
                            "e.g. \"I'm a PM, not an engineer. Skip implementation details and " +
                            "focus on what the feature does for end users.\""
                        }
                        maxLength={CHAT_CUSTOM_INSTRUCTIONS_MAX_LENGTH}
                        className="min-h-[120px]"
                        aria-label="Custom instructions"
                    />
                    <div
                        className={
                            isOverLimit
                                ? "text-xs text-destructive self-end"
                                : "text-xs text-muted-foreground self-end"
                        }
                    >
                        {customInstructions.length} / {CHAT_CUSTOM_INSTRUCTIONS_MAX_LENGTH}
                    </div>
                </div>
            </div>

            <div className="flex flex-row gap-2 justify-end items-center">
                {hasUnsavedChanges && (
                    <button
                        type="button"
                        onClick={handleReset}
                        className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                        disabled={isSaving}
                    >
                        Discard changes
                    </button>
                )}
                <LoadingButton
                    onClick={handleSave}
                    loading={isSaving}
                    disabled={!hasUnsavedChanges || isOverLimit}
                >
                    Save changes
                </LoadingButton>
            </div>
        </div>
    );
}
