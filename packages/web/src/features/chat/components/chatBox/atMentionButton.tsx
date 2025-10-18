'use client';

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AtSignIcon } from "lucide-react";
import { useCallback } from "react";
import { ReactEditor, useSlate } from "slate-react";
import { AtMentionInfoCard } from "./atMentionInfoCard";

// @note: we have this as a seperate component to avoid having to re-render the
// entire toolbar whenever the user types (since we are using the useSlate hook
// here).
export const AtMentionButton = () => {
    const editor = useSlate();

    const onAddContext = useCallback(() => {
        editor.insertText("@");
        ReactEditor.focus(editor);
    }, [editor]);

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 text-muted-foreground hover:text-primary"
                    onClick={onAddContext}
                >
                    <AtSignIcon className="w-4 h-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="p-0 border-0 bg-transparent shadow-none">
                <AtMentionInfoCard />
            </TooltipContent>
        </Tooltip>
    );
}