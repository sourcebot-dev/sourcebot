
export type SuggestionMode = 
    "none" |
    "refine" |
    "file"
;

export type RefineSuggestion = {
    type: 'refine';
    targetSuggestionMode: Exclude<SuggestionMode, 'none' | 'refine'>;
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

export type Suggestion = FileSuggestion | RefineSuggestion;
