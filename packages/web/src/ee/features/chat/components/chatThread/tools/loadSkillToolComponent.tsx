'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SBChatMessageToolTypes } from "@/features/chat/types";

type LoadSkillInput = SBChatMessageToolTypes['load_skill']['input'];
type LoadSkillOutput = SBChatMessageToolTypes['load_skill']['output'];

interface LoadSkillToolComponentProps {
    input: LoadSkillInput;
    output: LoadSkillOutput;
}

export const LoadSkillToolComponent = ({ input, output }: LoadSkillToolComponentProps) => {
    const [isOpen, setIsOpen] = useState(false);

    // The fail-closed path returns { error } as a normal (output-available)
    // result rather than throwing, so the unavailable case surfaces here.
    if ('error' in output) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                <span>Skill <span className="font-mono text-xs">{input.skill_id}</span> was unavailable</span>
            </div>
        );
    }

    const { skill, instructions } = output;
    const args = input.arguments?.trim();

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="w-full">
                <div className="flex items-center gap-2 select-none cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight className={cn("w-3 h-3 flex-shrink-0 transition-transform", isOpen && "rotate-90")} />
                    <Sparkles className="w-3 h-3 flex-shrink-0" />
                    <span className="flex-shrink-0">Loaded skill: <span className="text-foreground font-medium">{skill.name}</span></span>
                    <span className="font-mono text-xs text-muted-foreground/70 flex-shrink-0">/{skill.slug}</span>
                    {args && args.length > 0 && (
                        <span className="font-mono text-xs text-muted-foreground/70 truncate">{args}</span>
                    )}
                    <span className="flex-1" />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="ml-5 mt-1 rounded-lg border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap overflow-y-auto max-h-72">
                    {instructions}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};
