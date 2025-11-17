import { Tree, SyntaxNode } from "@sourcebot/query-language";
import { Q } from '@/proto/zoekt/webserver/v1/Q';
import {
    Program,
    AndExpr,
    OrExpr,
    NegateExpr,
    ParenExpr,
    PrefixExpr,
    Term,
    FileExpr,
    RepoExpr,
    RevisionExpr,
    ContentExpr,
    LangExpr,
    SymExpr,
    ArchivedExpr,
    ForkExpr,
    VisibilityExpr,
    RepoSetExpr
} from '@sourcebot/query-language';

/**
 * Transform a Lezer parse tree into a Zoekt gRPC query
 */
export const transformToZoektQuery = ({
    tree,
    input,
    isCaseSensitivityEnabled,
    isRegexEnabled,
}: {
    tree: Tree;
    input: string;
    isCaseSensitivityEnabled: boolean;
    isRegexEnabled: boolean;
}): Q => {

    const transformNode = (node: SyntaxNode): Q => {
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
                        children: getChildren(node).map(c => transformNode(c))
                    },
                    query: "and"
                }

            case OrExpr:
                return {
                    or: {
                        children: getChildren(node).map(c => transformNode(c))
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
                        child: transformNode(negateChild)
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

    const transformPrefixExpr = (node: SyntaxNode): Q => {
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
                const visibilityValue = value.toLowerCase();
                const flags: ('FLAG_ONLY_PUBLIC' | 'FLAG_ONLY_PRIVATE')[] = [];

                if (visibilityValue === 'public') {
                    flags.push('FLAG_ONLY_PUBLIC');
                } else if (visibilityValue === 'private') {
                    flags.push('FLAG_ONLY_PRIVATE');
                }
                // 'any' means no filter

                return {
                    raw_config: {
                        flags
                    },
                    query: "raw_config"
                };
            }

            // @todo: handle this
            case ArchivedExpr: {
                const archivedValue = value.toLowerCase();
                const flags: ('FLAG_ONLY_ARCHIVED' | 'FLAG_NO_ARCHIVED')[] = [];

                if (archivedValue === 'yes') {
                    // 'yes' means include archived repositories (default)
                } else if (archivedValue === 'no') {
                    flags.push('FLAG_NO_ARCHIVED');
                } else if (archivedValue === 'only') {
                    flags.push('FLAG_ONLY_ARCHIVED');
                }

                return {
                    raw_config: {
                        flags
                    },
                    query: "raw_config"
                };
            }
            case ForkExpr:
                // These are repo metadata filters
                // They need to be handled via repo filters in Zoekt
                // For now, return a const query (you might need custom handling)
                console.warn(`${prefixNode.type.name} not yet implemented`);
                return { const: true, query: "const" };

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

