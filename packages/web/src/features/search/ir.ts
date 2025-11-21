import { Q as QueryIR } from '@/proto/zoekt/webserver/v1/Q';
import { RawConfig } from '@/proto/zoekt/webserver/v1/RawConfig';
import { Regexp } from '@/proto/zoekt/webserver/v1/Regexp';
import { Symbol } from '@/proto/zoekt/webserver/v1/Symbol';
import { Language } from '@/proto/zoekt/webserver/v1/Language';
import { Repo } from '@/proto/zoekt/webserver/v1/Repo';
import { RepoRegexp } from '@/proto/zoekt/webserver/v1/RepoRegexp';
import { BranchesRepos } from '@/proto/zoekt/webserver/v1/BranchesRepos';
import { RepoIds } from '@/proto/zoekt/webserver/v1/RepoIds';
import { RepoSet } from '@/proto/zoekt/webserver/v1/RepoSet';
import { FileNameSet } from '@/proto/zoekt/webserver/v1/FileNameSet';
import { Type } from '@/proto/zoekt/webserver/v1/Type';
import { Substring } from '@/proto/zoekt/webserver/v1/Substring';
import { And } from '@/proto/zoekt/webserver/v1/And';
import { Or } from '@/proto/zoekt/webserver/v1/Or';
import { Not } from '@/proto/zoekt/webserver/v1/Not';
import { Branch } from '@/proto/zoekt/webserver/v1/Branch';
import { Boost } from '@/proto/zoekt/webserver/v1/Boost';

export type {
    QueryIR,
}

// Type guards for each query node type
export function isRawConfigQuery(query: QueryIR): query is QueryIR & { raw_config: RawConfig } {
    return query.raw_config != null;
}

export function isRegexpQuery(query: QueryIR): query is QueryIR & { regexp: Regexp } {
    return query.regexp != null;
}

export function isSymbolQuery(query: QueryIR): query is QueryIR & { symbol: Symbol } {
    return query.symbol != null;
}

export function isLanguageQuery(query: QueryIR): query is QueryIR & { language: Language } {
    return query.language != null;
}

export function isConstQuery(query: QueryIR): query is QueryIR & { const: boolean } {
    return query.const != null;
}

export function isRepoQuery(query: QueryIR): query is QueryIR & { repo: Repo } {
    return query.repo != null;
}

export function isRepoRegexpQuery(query: QueryIR): query is QueryIR & { repo_regexp: RepoRegexp } {
    return query.repo_regexp != null;
}

export function isBranchesReposQuery(query: QueryIR): query is QueryIR & { branches_repos: BranchesRepos } {
    return query.branches_repos != null;
}

export function isRepoIdsQuery(query: QueryIR): query is QueryIR & { repo_ids: RepoIds } {
    return query.repo_ids != null;
}

export function isRepoSetQuery(query: QueryIR): query is QueryIR & { repo_set: RepoSet } {
    return query.repo_set != null;
}

export function isFileNameSetQuery(query: QueryIR): query is QueryIR & { file_name_set: FileNameSet } {
    return query.file_name_set != null;
}

export function isTypeQuery(query: QueryIR): query is QueryIR & { type: Type } {
    return query.type != null;
}

export function isSubstringQuery(query: QueryIR): query is QueryIR & { substring: Substring } {
    return query.substring != null;
}

export function isAndQuery(query: QueryIR): query is QueryIR & { and: And } {
    return query.and != null;
}

export function isOrQuery(query: QueryIR): query is QueryIR & { or: Or } {
    return query.or != null;
}

export function isNotQuery(query: QueryIR): query is QueryIR & { not: Not } {
    return query.not != null;
}

export function isBranchQuery(query: QueryIR): query is QueryIR & { branch: Branch } {
    return query.branch != null;
}

export function isBoostQuery(query: QueryIR): query is QueryIR & { boost: Boost } {
    return query.boost != null;
}

/**
 * Visitor pattern for traversing a QueryIR tree.
 * Return false from any method to stop traversal early.
 */
export type QueryVisitor = {
    onRawConfig?: (query: QueryIR) => boolean | void;
    onRegexp?: (query: QueryIR) => boolean | void;
    onSymbol?: (query: QueryIR) => boolean | void;
    onLanguage?: (query: QueryIR) => boolean | void;
    onConst?: (query: QueryIR) => boolean | void;
    onRepo?: (query: QueryIR) => boolean | void;
    onRepoRegexp?: (query: QueryIR) => boolean | void;
    onBranchesRepos?: (query: QueryIR) => boolean | void;
    onRepoIds?: (query: QueryIR) => boolean | void;
    onRepoSet?: (query: QueryIR) => boolean | void;
    onFileNameSet?: (query: QueryIR) => boolean | void;
    onType?: (query: QueryIR) => boolean | void;
    onSubstring?: (query: QueryIR) => boolean | void;
    onAnd?: (query: QueryIR) => boolean | void;
    onOr?: (query: QueryIR) => boolean | void;
    onNot?: (query: QueryIR) => boolean | void;
    onBranch?: (query: QueryIR) => boolean | void;
    onBoost?: (query: QueryIR) => boolean | void;
};

/**
 * Traverses a QueryIR tree using the visitor pattern.
 * @param query The query to traverse
 * @param visitor An object with optional callback methods for each query type
 * @returns false if traversal was stopped early, true otherwise
 */
export function traverseQueryIR(
    query: QueryIR,
    visitor: QueryVisitor
): boolean {
    let shouldContinue: boolean | void = true;
    
    if (isRawConfigQuery(query)) {
        shouldContinue = visitor.onRawConfig?.(query);

    } else if (isRegexpQuery(query)) {
        shouldContinue = visitor.onRegexp?.(query);

    } else if (isSymbolQuery(query)) {
        shouldContinue = visitor.onSymbol?.(query);
        if (shouldContinue !== false && query.symbol.expr) {
            shouldContinue = traverseQueryIR(query.symbol.expr, visitor);
        }

    } else if (isLanguageQuery(query)) {
        shouldContinue = visitor.onLanguage?.(query);

    } else if (isConstQuery(query)) {
        shouldContinue = visitor.onConst?.(query);

    } else if (isRepoQuery(query)) {
        shouldContinue = visitor.onRepo?.(query);

    } else if (isRepoRegexpQuery(query)) {
        shouldContinue = visitor.onRepoRegexp?.(query);

    } else if (isBranchesReposQuery(query)) {
        shouldContinue = visitor.onBranchesRepos?.(query);

    } else if (isRepoIdsQuery(query)) {
        shouldContinue = visitor.onRepoIds?.(query);

    } else if (isRepoSetQuery(query)) {
        shouldContinue = visitor.onRepoSet?.(query);

    } else if (isFileNameSetQuery(query)) {
        shouldContinue = visitor.onFileNameSet?.(query);

    } else if (isTypeQuery(query)) {
        shouldContinue = visitor.onType?.(query);

    } else if (isSubstringQuery(query)) {
        shouldContinue = visitor.onSubstring?.(query);

    } else if (isAndQuery(query)) {
        shouldContinue = visitor.onAnd?.(query);
        if (shouldContinue !== false && query.and.children) {
            for (const child of query.and.children) {
                if (!traverseQueryIR(child, visitor)) {
                    return false;
                }
            }
        }

    } else if (isOrQuery(query)) {
        shouldContinue = visitor.onOr?.(query);
        if (shouldContinue !== false && query.or.children) {
            for (const child of query.or.children) {
                if (!traverseQueryIR(child, visitor)) {
                    return false;
                }
            }
        }

    } else if (isNotQuery(query)) {
        shouldContinue = visitor.onNot?.(query);
        if (shouldContinue !== false && query.not.child) {
            shouldContinue = traverseQueryIR(query.not.child, visitor);
        }

    } else if (isBranchQuery(query)) {
        shouldContinue = visitor.onBranch?.(query);

    } else if (isBoostQuery(query)) {
        shouldContinue = visitor.onBoost?.(query);
        if (shouldContinue !== false && query.boost.child) {
            shouldContinue = traverseQueryIR(query.boost.child, visitor);
        }
    }
    
    return shouldContinue !== false;
}

/**
 * Finds a node in the query tree that matches the predicate.
 * @param query The query to search
 * @param predicate A function that returns true if the node matches
 * @returns The first matching query node, or undefined if none found
 */
export function findInQueryIR(
    query: QueryIR,
    predicate: (query: QueryIR) => boolean
): QueryIR | undefined {
    let found: QueryIR | undefined;
    
    traverseQueryIR(query, {
        onRawConfig: (q) => { if (predicate(q)) { found = q; return false; } },
        onRegexp: (q) => { if (predicate(q)) { found = q; return false; } },
        onSymbol: (q) => { if (predicate(q)) { found = q; return false; } },
        onLanguage: (q) => { if (predicate(q)) { found = q; return false; } },
        onConst: (q) => { if (predicate(q)) { found = q; return false; } },
        onRepo: (q) => { if (predicate(q)) { found = q; return false; } },
        onRepoRegexp: (q) => { if (predicate(q)) { found = q; return false; } },
        onBranchesRepos: (q) => { if (predicate(q)) { found = q; return false; } },
        onRepoIds: (q) => { if (predicate(q)) { found = q; return false; } },
        onRepoSet: (q) => { if (predicate(q)) { found = q; return false; } },
        onFileNameSet: (q) => { if (predicate(q)) { found = q; return false; } },
        onType: (q) => { if (predicate(q)) { found = q; return false; } },
        onSubstring: (q) => { if (predicate(q)) { found = q; return false; } },
        onAnd: (q) => { if (predicate(q)) { found = q; return false; } },
        onOr: (q) => { if (predicate(q)) { found = q; return false; } },
        onNot: (q) => { if (predicate(q)) { found = q; return false; } },
        onBranch: (q) => { if (predicate(q)) { found = q; return false; } },
        onBoost: (q) => { if (predicate(q)) { found = q; return false; } },
    });
    
    return found;
}

/**
 * Checks if any node in the query tree matches the predicate.
 * @param query The query to search
 * @param predicate A function that returns true if the node matches
 * @returns true if any node matches, false otherwise
 */
export function someInQueryIR(
    query: QueryIR,
    predicate: (query: QueryIR) => boolean
): boolean {
    return findInQueryIR(query, predicate) !== undefined;
}
