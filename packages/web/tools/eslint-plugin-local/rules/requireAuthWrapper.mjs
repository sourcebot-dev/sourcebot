// ESLint rule: authz/require-auth-wrapper
//
// Flags API route handlers and server-action exports that don't textually
// reference one of the recognized auth wrappers (`withAuth(` or
// `withOptionalAuth(`) inside the exported function body. This is a
// boundary-only check — it does not trace through helper functions. If a
// handler legitimately delegates auth into a helper, suppress with:
//
//   // eslint-disable-next-line authz/require-auth-wrapper -- <reason>
//
// `withMinimumOrgRole` is intentionally NOT recognized — it nests inside
// `withAuth` and means nothing on its own.

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']);
const AUTH_PATTERN = /\b(?:withAuth|withOptionalAuth)\s*\(/;
const USE_SERVER = 'use server';

const isStringLiteral = (node) =>
    node?.type === 'Literal' && typeof node.value === 'string';

const isUseServerDirective = (stmt) =>
    stmt?.type === 'ExpressionStatement' &&
    isStringLiteral(stmt.expression) &&
    stmt.expression.value === USE_SERVER;

const hasUseServerInDirectivePrologue = (statements) => {
    if (!statements) {
        return false;
    }
    for (const stmt of statements) {
        if (isUseServerDirective(stmt)) {
            return true;
        }
        const isDirective =
            stmt.type === 'ExpressionStatement' && isStringLiteral(stmt.expression);
        if (!isDirective) {
            return false;
        }
    }
    return false;
};

const getFunctionBody = (node) => {
    if (!node) {
        return null;
    }
    if (
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression' ||
        node.type === 'FunctionDeclaration'
    ) {
        return node.body;
    }
    return null;
};

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Require an auth wrapper (withAuth / withOptionalAuth) on API route handlers and server actions',
        },
        schema: [],
        messages: {
            missingWrapperRoute:
                'Route handler "{{ name }}" must call withAuth() or withOptionalAuth() in its body. ' +
                'withMinimumOrgRole alone is not sufficient. If this endpoint is intentionally public, ' +
                'suppress with: // eslint-disable-next-line authz/require-auth-wrapper -- <reason>. ' +
                'Example: export const GET = apiHandler(async (req) => withAuth(async ({ user, prisma }) => { ... }));',
            missingWrapperAction:
                'Server action "{{ name }}" must call withAuth() or withOptionalAuth() in its body. ' +
                'If this action is intentionally public, suppress with: ' +
                '// eslint-disable-next-line authz/require-auth-wrapper -- <reason>. ' +
                'Example: export const foo = async () => sew(() => withAuth(async ({ user }) => { ... }));',
        },
    },

    create(context) {
        const filename =
            (typeof context.filename === 'string' ? context.filename : null) ??
            (typeof context.getFilename === 'function' ? context.getFilename() : '');
        const sourceCode = context.sourceCode ?? context.getSourceCode();

        const normalized = filename.replace(/\\/g, '/');
        const isRouteFile = /\/app\/api\/.*\/route\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(normalized);

        const program = sourceCode.ast;
        const fileLevelUseServer = hasUseServerInDirectivePrologue(program.body);

        // Bail early on files that can't possibly host a route or action.
        if (
            !isRouteFile &&
            !fileLevelUseServer &&
            !sourceCode.text.includes(USE_SERVER)
        ) {
            return {};
        }

        const functionLevelUseServer = (fnBody) => {
            if (!fnBody || fnBody.type !== 'BlockStatement') {
                return false;
            }
            return hasUseServerInDirectivePrologue(fnBody.body);
        };

        // Resolve a local name (used by `export { handler as GET }`) to the text
        // of its initializer / declaration so we can grep it for the wrapper.
        const findLocalDeclarationText = (localName) => {
            for (const stmt of program.body) {
                if (stmt.type === 'VariableDeclaration') {
                    for (const decl of stmt.declarations) {
                        if (decl.id.type === 'Identifier' && decl.id.name === localName && decl.init) {
                            return sourceCode.getText(decl.init);
                        }
                    }
                } else if (
                    stmt.type === 'FunctionDeclaration' &&
                    stmt.id?.name === localName
                ) {
                    return sourceCode.getText(stmt);
                } else if (
                    stmt.type === 'ExportNamedDeclaration' &&
                    stmt.declaration?.type === 'VariableDeclaration'
                ) {
                    for (const decl of stmt.declaration.declarations) {
                        if (decl.id.type === 'Identifier' && decl.id.name === localName && decl.init) {
                            return sourceCode.getText(decl.init);
                        }
                    }
                } else if (
                    stmt.type === 'ExportNamedDeclaration' &&
                    stmt.declaration?.type === 'FunctionDeclaration' &&
                    stmt.declaration.id?.name === localName
                ) {
                    return sourceCode.getText(stmt.declaration);
                }
            }
            return null;
        };

        const reportIfMissing = (reportNode, name, bodyText, kind) => {
            if (bodyText && AUTH_PATTERN.test(bodyText)) {
                return;
            }
            context.report({
                node: reportNode,
                messageId: kind === 'route' ? 'missingWrapperRoute' : 'missingWrapperAction',
                data: { name },
            });
        };

        const classifyExport = (name, valueNode) => {
            if (isRouteFile && HTTP_METHODS.has(name)) {
                return 'route';
            }
            if (fileLevelUseServer) {
                return 'action';
            }
            const body = getFunctionBody(valueNode);
            if (body && functionLevelUseServer(body)) {
                return 'action';
            }
            return null;
        };

        return {
            ExportNamedDeclaration(node) {
                // export const X = ..., export async function X() {}
                if (node.declaration?.type === 'VariableDeclaration') {
                    for (const declarator of node.declaration.declarations) {
                        if (declarator.id.type === 'Identifier') {
                            const name = declarator.id.name;
                            const kind = classifyExport(name, declarator.init);
                            if (!kind) {
                                continue;
                            }
                            const text = declarator.init
                                ? sourceCode.getText(declarator.init)
                                : '';
                            reportIfMissing(node, name, text, kind);
                        } else if (declarator.id.type === 'ObjectPattern') {
                            // export const { GET, POST } = handlers;
                            const initText = declarator.init
                                ? sourceCode.getText(declarator.init)
                                : '';
                            for (const prop of declarator.id.properties) {
                                if (
                                    prop.type !== 'Property' ||
                                    prop.key.type !== 'Identifier'
                                ) {
                                    continue;
                                }
                                const name = prop.key.name;
                                const kind = classifyExport(name, declarator.init);
                                if (!kind) {
                                    continue;
                                }
                                reportIfMissing(node, name, initText, kind);
                            }
                        }
                    }
                    return;
                }

                if (node.declaration?.type === 'FunctionDeclaration') {
                    const id = node.declaration.id;
                    if (!id) {
                        return;
                    }
                    const kind = classifyExport(id.name, node.declaration);
                    if (!kind) {
                        return;
                    }
                    const text = sourceCode.getText(node.declaration);
                    reportIfMissing(node, id.name, text, kind);
                    return;
                }

                // export { handler as GET, ... }
                if (node.specifiers?.length && !node.source) {
                    for (const specifier of node.specifiers) {
                        if (specifier.type !== 'ExportSpecifier') {
                            continue;
                        }
                        const exportedName =
                            specifier.exported.type === 'Identifier'
                                ? specifier.exported.name
                                : null;
                        const localName =
                            specifier.local.type === 'Identifier'
                                ? specifier.local.name
                                : null;
                        if (!exportedName || !localName) {
                            continue;
                        }
                        const kind = classifyExport(exportedName, null);
                        if (!kind) {
                            continue;
                        }
                        const localText = findLocalDeclarationText(localName) ?? '';
                        reportIfMissing(specifier, exportedName, localText, kind);
                    }
                }
            },
        };
    },
};

export default rule;
