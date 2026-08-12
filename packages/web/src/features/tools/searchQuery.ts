import globToRegexp from "glob-to-regexp";
import type { QueryIR } from "@/features/search/ir";

type SearchScope = {
    repo?: string;
    ref?: string;
    selectedRepos?: string[];
};

type GrepSearchQuery = SearchScope & {
    pattern: string;
    path?: string;
    include?: string;
};

type GlobSearchQuery = SearchScope & {
    pattern: string;
    path?: string;
};

const createRegexpQuery = ({
    regexp,
    fileName,
    content,
}: {
    regexp: string;
    fileName: boolean;
    content: boolean;
}): QueryIR => ({
    regexp: {
        regexp,
        case_sensitive: true,
        file_name: fileName,
        content,
    },
    query: "regexp",
});

// Keep literal tool inputs compatible with Zoekt's RE2 parser. The generic
// escape-string-regexp package emits hex escapes for some characters.
const escapeRE2Regexp = (value: string): string => value.replace(/[\\.^$|?*+()[\]{}]/g, '\\$&');

const globToFileRegexp = (glob: string): string => {
    const regexp = globToRegexp(glob, { extended: true, globstar: true });
    return regexp.source.replace(/^\^/, '');
};

const createRepoScopeQuery = ({ repo, selectedRepos }: SearchScope): QueryIR | undefined => {
    const repos = repo ? [repo] : selectedRepos;
    if (!repos || repos.length === 0) {
        return undefined;
    }

    return {
        repo_set: {
            set: Object.fromEntries(repos.map((repoName) => [repoName, true])),
        },
        query: "repo_set",
    };
};

const createBranchQuery = (ref?: string): QueryIR | undefined => ref ? {
    branch: {
        pattern: ref === '*' ? '' : ref,
        exact: false,
    },
    query: "branch",
} : undefined;

const combineQueries = (queries: Array<QueryIR | undefined>): QueryIR => {
    const children = queries.filter((query): query is QueryIR => query !== undefined);
    if (children.length === 1) {
        return children[0];
    }

    return {
        and: { children },
        query: "and",
    };
};

export const buildGrepSearchQuery = ({
    pattern,
    path,
    include,
    repo,
    ref,
    selectedRepos,
}: GrepSearchQuery): QueryIR => combineQueries([
    createRegexpQuery({
        regexp: pattern,
        fileName: false,
        content: true,
    }),
    path ? createRegexpQuery({
        regexp: escapeRE2Regexp(path),
        fileName: true,
        content: false,
    }) : undefined,
    include ? createRegexpQuery({
        regexp: globToFileRegexp(include),
        fileName: true,
        content: false,
    }) : undefined,
    createRepoScopeQuery({ repo, selectedRepos }),
    createBranchQuery(ref),
]);

export const buildGlobSearchQuery = ({
    pattern,
    path,
    repo,
    ref,
    selectedRepos,
}: GlobSearchQuery): QueryIR => combineQueries([
    createRegexpQuery({
        regexp: globToFileRegexp(pattern),
        fileName: true,
        content: false,
    }),
    path ? createRegexpQuery({
        regexp: escapeRE2Regexp(path),
        fileName: true,
        content: false,
    }) : undefined,
    createRepoScopeQuery({ repo, selectedRepos }),
    createBranchQuery(ref),
]);
