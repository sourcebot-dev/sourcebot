import type { AskCommandSuggestion } from "@/features/chat/commands/types";

export type SuggestionMode = 
    "none" |
    "refine" |
    "command" |
    "file"
;

export type RefineSuggestion = {
    type: 'refine';
    name: string;
    description: string;
}

export type FileSuggestion = {
    type: 'file';
    repo: string;
    path: string;
    name: string;
    language: string;
    revision: string;
}

export type Suggestion = FileSuggestion | RefineSuggestion | AskCommandSuggestion;
