import { Tree, SyntaxNode } from "@sourcebot/query-language";
import { Q  } from '@/proto/zoekt/webserver/v1/Q';

/**
 * Transform a Lezer parse tree into a Zoekt gRPC query
 */
export function transformToZoektQuery(tree: Tree, input: string): Q {
    return transformNode(tree.topNode, input);
}

function transformNode(node: SyntaxNode, input: string): Q {
    const nodeName = node.type.name;

    switch (nodeName) {
        case "Program": {
            // Program wraps the actual query - transform its child
            const child = node.firstChild;
            if (!child) {
                // Empty query - match nothing
                return { const: false, query: "const" };
            }
            return transformNode(child, input);
        }
        case "AndExpr":
            return {
                and: {
                    children: getChildren(node).map(c => transformNode(c, input))
                },
                query: "and"
            }

        case "OrExpr":
            return {
                or: {
                    children: getChildren(node).map(c => transformNode(c, input))
                },
                query: "or"
            };

        case "NegateExpr": {
            // Find the child after the negate token
            const negateChild = node.getChild("PrefixExpr") || node.getChild("ParenExpr");
            if (!negateChild) {
                throw new Error("NegateExpr missing child");
            }
            return {
                not: {
                    child: transformNode(negateChild, input)
                },
                query: "not"
            };
        }
        case "ParenExpr": {
            // Parentheses just group - transform the inner query
            const innerQuery = node.getChild("query") || node.firstChild;
            if (!innerQuery) {
                return { const: false, query: "const" };
            }
            return transformNode(innerQuery, input);
        }
        case "PrefixExpr":
            // PrefixExpr contains specific prefix types
            return transformPrefixExpr(node, input);

        case "Term": {
            // Plain search term - becomes substring search in content
            const termText = input.substring(node.from, node.to);
            return {
                substring: {
                    pattern: termText.replace(/^"|"$/g, ''), // Remove quotes if present
                    case_sensitive: false,
                    file_name: false,
                    content: true
                },
                query: "substring"
            };
        }
        default:
            console.warn(`Unhandled node type: ${nodeName}`);
            return { const: true, query: "const" };
    }
}

function transformPrefixExpr(node: SyntaxNode, input: string): Q {
    // Find which specific prefix type this is
    const prefixNode = node.firstChild;
    if (!prefixNode) {
        throw new Error("PrefixExpr has no child");
    }

    const prefixType = prefixNode.type.name;
    
    // Extract the full text (e.g., "file:test.js") and split on the colon
    const fullText = input.substring(prefixNode.from, prefixNode.to);
    const colonIndex = fullText.indexOf(':');
    if (colonIndex === -1) {
        throw new Error(`${prefixType} missing colon`);
    }
    
    // Get the value part after the colon and remove quotes if present
    const value = fullText.substring(colonIndex + 1).replace(/^"|"$/g, '');

    switch (prefixType) {
        case "FileExpr":
            return {
                substring: {
                    pattern: value,
                    case_sensitive: false,
                    file_name: true,
                    content: false
                },
                query: "substring"
            };

        case "RepoExpr":
            return {
                repo: {
                    regexp: value
                },
                query: "repo"
            };

        case "BranchExpr":
            return {
                branch: {
                    pattern: value,
                    exact: false
                },
                query: "branch"
            };

        case "ContentExpr":
            return {
                substring: {
                    pattern: value,
                    case_sensitive: false,
                    file_name: false,
                    content: true
                },
                query: "substring"
            };

        case "CaseExpr": {
            // case:yes/no wraps the next term with case sensitivity
            const caseValue = value.toLowerCase();
            const isCaseSensitive = caseValue === "yes" || caseValue === "true";
            return {
                substring: {
                    pattern: value,
                    case_sensitive: isCaseSensitive,
                    file_name: false,
                    content: true
                },
                query: "substring"
            };
        }
        case "LangExpr":
            return {
                language: {
                    language: value
                },
                query: "language"
            };

        case "SymExpr":
            // Symbol search wraps a pattern
            return {
                symbol: {
                    expr: {
                        substring: {
                            pattern: value,
                            case_sensitive: false,
                            file_name: false,
                            content: true
                        },
                        query: "substring"
                    }
                },
                query: "symbol"
            };
        case "RegexExpr":
            return {
                regexp: {
                    regexp: value,
                    case_sensitive: false,
                    file_name: false,
                    content: true
                },
                query: "regexp"
            };

        // @todo: handle this
        case "ArchivedExpr":
        case "ForkExpr":
        case "PublicExpr":
            // These are repo metadata filters
            // They need to be handled via repo filters in Zoekt
            // For now, return a const query (you might need custom handling)
            console.warn(`${prefixType} not yet implemented`);
            return { const: true, query: "const" };

        case "RepoSetExpr": {
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
            throw new Error(`Unknown prefix type: ${prefixType}`);
    }
}

function getChildren(node: SyntaxNode): SyntaxNode[] {
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

