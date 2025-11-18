import { Q } from '@/proto/zoekt/webserver/v1/Q';
import {
    AndExpr,
    ArchivedExpr,
    ContentExpr,
    ContextExpr,
    FileExpr,
    ForkExpr,
    LangExpr,
    NegateExpr,
    OrExpr,
    ParenExpr,
    PrefixExpr,
    Program,
    RepoExpr,
    RepoSetExpr,
    RevisionExpr,
    SymExpr,
    SyntaxNode,
    Term,
    Tree,
    VisibilityExpr,
} from '@sourcebot/query-language';

type ArchivedValue = 'yes' | 'no' | 'only';
type VisibilityValue = 'public' | 'private' | 'any';
type ForkValue = 'yes' | 'no' | 'only';

const isArchivedValue = (value: string): value is ArchivedValue => {
    return value === 'yes' || value === 'no' || value === 'only';
}

const isVisibilityValue = (value: string): value is VisibilityValue => {
    return value === 'public' || value === 'private' || value === 'any';
}

const isForkValue = (value: string): value is ForkValue => {
    return value === 'yes' || value === 'no' || value === 'only';
}

/**
 * Transform a Lezer parse tree into a Zoekt gRPC query
 */
export const transformToZoektQuery = ({
    tree,
    input,
    isCaseSensitivityEnabled,
    isRegexEnabled,
    onExpandSearchContext,
}: {
    tree: Tree;
    input: string;
    isCaseSensitivityEnabled: boolean;
    isRegexEnabled: boolean;
    onExpandSearchContext: (contextName: string) => Promise<string[]>;
}): Promise<Q> => {

    const transformNode = async (node: SyntaxNode): Promise<Q> => {
        switch (node.type.id) {
            case Program: {
                // Program wraps the actual query - transform its child
                const child = node.firstChild;
                if (!child) {
                    // Empty query - match nothing
                    return { const: false, query: "const" };
                }
                return transformNode(child);
            }
            case AndExpr:
                return {
                    and: {
                        children: await Promise.all(getChildren(node).map(c => transformNode(c)))
                    },
                    query: "and"
                }

            case OrExpr:
                return {
                    or: {
                        children: await Promise.all(getChildren(node).map(c => transformNode(c)))
                    },
                    query: "or"
                };

            case NegateExpr: {
                // Find the child after the negate token
                const negateChild = node.getChild("PrefixExpr") || node.getChild("ParenExpr");
                if (!negateChild) {
                    throw new Error("NegateExpr missing child");
                }
                return {
                    not: {
                        child: await transformNode(negateChild)
                    },
                    query: "not"
                };
            }
            case ParenExpr: {
                // Parentheses just group - transform the inner query
                const innerQuery = node.getChild("query") || node.firstChild;
                if (!innerQuery) {
                    return { const: false, query: "const" };
                }
                return transformNode(innerQuery);
            }
            case PrefixExpr:
                // PrefixExpr contains specific prefix types
                return transformPrefixExpr(node);

            case Term: {
                const termText = input.substring(node.from, node.to).replace(/^"|"$/g, '');

                return isRegexEnabled ? {
                    regexp: {
                        regexp: termText,
                        case_sensitive: isCaseSensitivityEnabled,
                        file_name: false,
                        content: true
                    },
                    query: "regexp"
                } : {
                    substring: {
                        pattern: termText,
                        case_sensitive: isCaseSensitivityEnabled,
                        file_name: false,
                        content: true
                    },
                    query: "substring"
                };
            }
            default:
                console.warn(`Unhandled node type: ${node.type.name} (id: ${node.type.id})`);
                return { const: true, query: "const" };
        }
    }

    const transformPrefixExpr = async (node: SyntaxNode): Promise<Q> => {
        // Find which specific prefix type this is
        const prefixNode = node.firstChild;
        if (!prefixNode) {
            throw new Error("PrefixExpr has no child");
        }

        const prefixTypeId = prefixNode.type.id;

        // Extract the full text (e.g., "file:test.js") and split on the colon
        const fullText = input.substring(prefixNode.from, prefixNode.to);
        const colonIndex = fullText.indexOf(':');
        if (colonIndex === -1) {
            throw new Error(`${prefixNode.type.name} missing colon`);
        }

        // Get the value part after the colon and remove quotes if present
        const value = fullText.substring(colonIndex + 1).replace(/^"|"$/g, '');

        switch (prefixTypeId) {
            case FileExpr:
                return {
                    regexp: {
                        regexp: value,
                        case_sensitive: isCaseSensitivityEnabled,
                        file_name: true,
                        content: false
                    },
                    query: "regexp"
                };

            case RepoExpr:
                return {
                    repo: {
                        regexp: value
                    },
                    query: "repo"
                };

            case RevisionExpr:
                return {
                    branch: {
                        pattern: value,
                        exact: false
                    },
                    query: "branch"
                };

            case ContentExpr:
                return {
                    substring: {
                        pattern: value,
                        case_sensitive: isCaseSensitivityEnabled,
                        file_name: false,
                        content: true
                    },
                    query: "substring"
                };

 
            case LangExpr:
                return {
                    language: {
                        language: value
                    },
                    query: "language"
                };

            case SymExpr:
                // Symbol search wraps a pattern
                return {
                    symbol: {
                        expr: {
                            substring: {
                                pattern: value,
                                case_sensitive: isCaseSensitivityEnabled,
                                file_name: false,
                                content: true
                            },
                            query: "substring"
                        }
                    },
                    query: "symbol"
                };

            case VisibilityExpr: {
                const rawValue = value.toLowerCase();

                if (!isVisibilityValue(rawValue)) {
                    throw new Error(`Invalid visibility value: ${rawValue}. Expected 'public', 'private', or 'any'`);
                }

                const flags: ('FLAG_ONLY_PUBLIC' | 'FLAG_ONLY_PRIVATE')[] = [];

                if (rawValue === 'any') {
                    // 'any' means no filter
                } else if (rawValue === 'public') {
                    flags.push('FLAG_ONLY_PUBLIC');
                } else if (rawValue === 'private') {
                    flags.push('FLAG_ONLY_PRIVATE');
                }

                return {
                    raw_config: {
                        flags
                    },
                    query: "raw_config"
                };
            }

            case ArchivedExpr: {
                const rawValue = value.toLowerCase();

                if (!isArchivedValue(rawValue)) {
                    throw new Error(`Invalid archived value: ${rawValue}. Expected 'yes', 'no', or 'only'`);
                }

                const flags: ('FLAG_ONLY_ARCHIVED' | 'FLAG_NO_ARCHIVED')[] = [];

                if (rawValue === 'yes') {
                    // 'yes' means include archived repositories (default)
                } else if (rawValue === 'no') {
                    flags.push('FLAG_NO_ARCHIVED');
                } else if (rawValue === 'only') {
                    flags.push('FLAG_ONLY_ARCHIVED');
                }

                return {
                    raw_config: {
                        flags
                    },
                    query: "raw_config"
                };
            }
            case ForkExpr: {
                const rawValue = value.toLowerCase();
                
                if (!isForkValue(rawValue)) {
                    throw new Error(`Invalid fork value: ${rawValue}. Expected 'yes', 'no', or 'only'`);
                }
                
                const flags: ('FLAG_ONLY_FORKS' | 'FLAG_NO_FORKS')[] = [];

                if (rawValue === 'yes') {
                    // 'yes' means include forks (default)
                } else if (rawValue === 'no') {
                    flags.push('FLAG_NO_FORKS');
                } else if (rawValue === 'only') {
                    flags.push('FLAG_ONLY_FORKS');
                }

                return {
                    raw_config: {
                        flags
                    },
                    query: "raw_config"
                };
            }

            case ContextExpr: {
                const repoNames = await onExpandSearchContext(value);
                return {
                    repo_set: {
                        set: repoNames.reduce((acc, s) => {
                            acc[s.trim()] = true;
                            return acc;
                        }, {} as Record<string, boolean>)
                    },
                    query: "repo_set"
                };
            }

            case RepoSetExpr: {
                return {
                    repo_set: {
                        set: value.split(',').reduce((acc, s) => {
                            acc[s.trim()] = true;
                            return acc;
                        }, {} as Record<string, boolean>)
                    },
                    query: "repo_set"
                };
            }
            default:
                throw new Error(`Unknown prefix type: ${prefixNode.type.name} (id: ${prefixTypeId})`);
        }
    }

    return transformNode(tree.topNode);
}

const getChildren = (node: SyntaxNode): SyntaxNode[] => {
    const children: SyntaxNode[] = [];
    let child = node.firstChild;
    while (child) {
        // Skip certain node types that are just structural
        if (!["(", ")", "or"].includes(child.type.name)) {
            children.push(child);
        }
        child = child.nextSibling;
    }
    return children;
}

