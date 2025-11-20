import { Q as QueryIR } from '@/proto/zoekt/webserver/v1/Q';

export type {
    QueryIR,
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
    if (!query.query) {
        return true;
    }

    // Call the appropriate visitor method
    let shouldContinue: boolean | void = true;
    
    switch (query.query) {
        case 'raw_config':
            shouldContinue = visitor.onRawConfig?.(query);
            break;
        case 'regexp':
            shouldContinue = visitor.onRegexp?.(query);
            if (shouldContinue !== false && query.regexp) {
                // Symbol expressions contain nested queries
                if (query.regexp) {
                    shouldContinue = true;
                }
            }
            break;
        case 'symbol':
            shouldContinue = visitor.onSymbol?.(query);
            if (shouldContinue !== false && query.symbol?.expr) {
                shouldContinue = traverseQueryIR(query.symbol.expr, visitor);
            }
            break;
        case 'language':
            shouldContinue = visitor.onLanguage?.(query);
            break;
        case 'const':
            shouldContinue = visitor.onConst?.(query);
            break;
        case 'repo':
            shouldContinue = visitor.onRepo?.(query);
            break;
        case 'repo_regexp':
            shouldContinue = visitor.onRepoRegexp?.(query);
            break;
        case 'branches_repos':
            shouldContinue = visitor.onBranchesRepos?.(query);
            break;
        case 'repo_ids':
            shouldContinue = visitor.onRepoIds?.(query);
            break;
        case 'repo_set':
            shouldContinue = visitor.onRepoSet?.(query);
            break;
        case 'file_name_set':
            shouldContinue = visitor.onFileNameSet?.(query);
            break;
        case 'type':
            shouldContinue = visitor.onType?.(query);
            break;
        case 'substring':
            shouldContinue = visitor.onSubstring?.(query);
            break;
        case 'and':
            shouldContinue = visitor.onAnd?.(query);
            if (shouldContinue !== false && query.and?.children) {
                for (const child of query.and.children) {
                    if (!traverseQueryIR(child, visitor)) {
                        return false;
                    }
                }
            }
            break;
        case 'or':
            shouldContinue = visitor.onOr?.(query);
            if (shouldContinue !== false && query.or?.children) {
                for (const child of query.or.children) {
                    if (!traverseQueryIR(child, visitor)) {
                        return false;
                    }
                }
            }
            break;
        case 'not':
            shouldContinue = visitor.onNot?.(query);
            if (shouldContinue !== false && query.not?.child) {
                shouldContinue = traverseQueryIR(query.not.child, visitor);
            }
            break;
        case 'branch':
            shouldContinue = visitor.onBranch?.(query);
            break;
        case 'boost':
            shouldContinue = visitor.onBoost?.(query);
            if (shouldContinue !== false && query.boost?.child) {
                shouldContinue = traverseQueryIR(query.boost.child, visitor);
            }
            break;
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
