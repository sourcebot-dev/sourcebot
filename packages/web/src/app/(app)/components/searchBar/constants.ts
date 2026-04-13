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
    fork = "fork:",
    visibility = "visibility:",
    context = "context:",
}

export const visibilityModeSuggestions: Suggestion[] = [
    {
        value: "public",
        description: "Only include results from public repositories."
    },
    {
        value: "private",
        description: "Only include results from private repositories."
    },
    {
        value: "any",
        description: "Include results from both public and private repositories (default)."
    },
];

export const forkModeSuggestions: Suggestion[] = [
    {
        value: "yes",
        description: "Include results from forked repositories (default)."
    },
    {
        value: "no",
        description: "Exclude results from forked repositories."
    },
    {
        value: "only",
        description: "Only include results from forked repositories."
    }
];

export const archivedModeSuggestions: Suggestion[] = [
    {
        value: "yes",
        description: "Include results from archived repositories (default)."
    },
    {
        value: "no",
        description: "Exclude results from archived repositories."
    },
    {
        value: "only",
        description: "Only include results from archived repositories."
    }
];

