import { Suggestion, SuggestionMode } from "./searchSuggestionsBox";

/**
 * List of search prefixes that can be used while the
 * `refine` suggestion mode is active.
 */
enum SearchPrefix {
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
    public = "public:"
}

const negate = (prefix: SearchPrefix) => {
    return `-${prefix}`;
}

type SuggestionModeMapping = {
    suggestionMode: SuggestionMode,
    prefixes: string[],
}

/**
 * Maps search prefixes to a suggestion mode. When a query starts
 * with a prefix, the corresponding suggestion mode is enabled.
 * @see [searchSuggestionsBox.tsx](./searchSuggestionsBox.tsx)
 */
export const suggestionModeMappings: SuggestionModeMapping[] = [
    {
        suggestionMode: "repo",
        prefixes: [
            SearchPrefix.repo, negate(SearchPrefix.repo),
            SearchPrefix.r, negate(SearchPrefix.r),
        ]
    },
    {
        suggestionMode: "language",
        prefixes: [
            SearchPrefix.lang, negate(SearchPrefix.lang),
        ]
    },
    {
        suggestionMode: "file",
        prefixes: [
            SearchPrefix.file, negate(SearchPrefix.file),
        ]
    },
    {
        suggestionMode: "content",
        prefixes: [
            SearchPrefix.content, negate(SearchPrefix.content),
        ]
    },
    {
        suggestionMode: "revision",
        prefixes: [
            SearchPrefix.rev, negate(SearchPrefix.rev),
            SearchPrefix.revision, negate(SearchPrefix.revision),
            SearchPrefix.branch, negate(SearchPrefix.branch),
            SearchPrefix.b, negate(SearchPrefix.b),
        ]
    },
    {
        suggestionMode: "symbol",
        prefixes: [
            SearchPrefix.sym, negate(SearchPrefix.sym),
        ]
    },
    {
        suggestionMode: "archived",
        prefixes: [
            SearchPrefix.archived
        ]
    },
    {
        suggestionMode: "case",
        prefixes: [
            SearchPrefix.case
        ]
    },
    {
        suggestionMode: "fork",
        prefixes: [
            SearchPrefix.fork
        ]
    },
    {
        suggestionMode: "public",
        prefixes: [
            SearchPrefix.public
        ]
    }
]

export const refineModeSuggestions: Suggestion[] = [
    {
        value: SearchPrefix.repo,
        description: "Include only results from the given repository.",
        spotlight: true,
    },
    {
        value: negate(SearchPrefix.repo),
        description: "Exclude results from the given repository."
    },
    {
        value: SearchPrefix.lang,
        description: "Include only results from the given language.",
        spotlight: true,
    },
    {
        value: negate(SearchPrefix.lang),
        description: "Exclude results from the given language."
    },
    {
        value: SearchPrefix.file,
        description: "Include only results from filepaths matching the given search pattern.",
        spotlight: true,
    },
    {
        value: negate(SearchPrefix.file),
        description: "Exclude results from file paths matching the given search pattern."
    },
    {
        value: SearchPrefix.rev,
        description: "Search a given branch or tag instead of the default branch.",
        spotlight: true,
    },
    {
        value: negate(SearchPrefix.rev),
        description: "Exclude results from the given branch or tag."
    },
    {
        value: SearchPrefix.sym,
        description: "Include only symbols matching the given search pattern.",
        spotlight: true,
    },
    {
        value: negate(SearchPrefix.sym),
        description: "Exclude results from symbols matching the given search pattern."
    },
    {
        value: SearchPrefix.content,
        description: "Include only results from files if their content matches the given search pattern."
    },
    {
        value: negate(SearchPrefix.content),
        description: "Exclude results from files if their content matches the given search pattern."
    },
    {
        value: SearchPrefix.archived,
        description: "Include results from archived repositories.",
    },
    {
        value: SearchPrefix.case,
        description: "Control case-sensitivity of search patterns."
    },
    {
        value: SearchPrefix.fork,
        description: "Include only results from forked repositories."
    },
    {
        value: SearchPrefix.public,
        description: "Filter on repository visibility."
    },
];

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

