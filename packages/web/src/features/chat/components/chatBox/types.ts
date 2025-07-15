
export type SuggestionMode = 
    "none" |
    "refine" |
    "file" |
    "repo"
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

export type RepoSuggestion = {
    type: 'repo';
    name: string;
    displayName?: string;
    codeHostType: string;
}

export type Suggestion = FileSuggestion | RepoSuggestion | RefineSuggestion;
