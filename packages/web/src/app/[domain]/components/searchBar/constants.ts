import { Suggestion } from "./searchSuggestionsBox";

/**
 * List of search prefixes that can be used while the
 * `refine` suggestion mode is active.
 */
export enum SearchPrefix {
    repo = "repo:",
    r = "r:",
    lang = "lang:",
    file = "file:",
    rev = "rev:",
    revision = "revision:",
    b = "b:",
    branch = "branch:",
    sym = "sym:",
    content = "content:",
    archived = "archived:",
    case = "case:",
    fork = "fork:",
    public = "public:",
    context = "context:",
}

export const publicModeSuggestions: Suggestion[] = [
    {
        value: "yes",
        description: "Only include results from public repositories."
    },
    {
        value: "no",
        description: "Only include results from private repositories."
    },
];

export const forkModeSuggestions: Suggestion[] = [
    {
        value: "yes",
        description: "Only include results from forked repositories."
    },
    {
        value: "no",
        description: "Only include results from non-forked repositories."
    },
];

export const caseModeSuggestions: Suggestion[] = [
    {
        value: "auto",
        description: "Search patterns are case-insensitive if all characters are lowercase, and case sensitive otherwise (default)."
    },
    {
        value: "yes",
        description: "Case sensitive search."
    },
    {
        value: "no",
        description: "Case insensitive search."
    },
];

export const archivedModeSuggestions: Suggestion[] = [
    {
        value: "yes",
        description: "Only include results in archived repositories."
    },
    {
        value: "no",
        description: "Only include results in non-archived repositories."
    },
];

