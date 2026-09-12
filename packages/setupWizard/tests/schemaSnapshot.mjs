import ts from 'typescript';
import { readFileSync } from 'node:fs';

// Extract the declared schema for comparison with an independently checked-in
// snapshot. Tests must not silently accept new properties just because the
// production allowlist also changed.
export function declaredSchema() {
    const source = ts.createSourceFile('telemetryEvents.ts', readFileSync(new URL('../src/telemetryEvents.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    const bindings = new Map();
    for (const statement of source.statements) {
        if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                bindings.set(declaration.name.getText(source), declaration.initializer);
            }
        }
    }
    function resolve(node) {
        if (!node) {
            throw Error('Unrecognized telemetry declaration');
        }
        if (ts.isIdentifier(node)) {
            return resolve(bindings.get(node.text));
        }
        if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) {
            return resolve(node.expression);
        }
        if (ts.isObjectLiteralExpression(node)) {
            return Object.assign({}, ...node.properties.map(property => {
                if (ts.isSpreadAssignment(property)) {
                    return resolve(property.expression);
                }
                const name = property.name.getText(source);
                return { [name]: resolve(ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer) };
            }));
        }
        if (ts.isCallExpression(node)) {
            const name = node.expression.getText(source);
            if (name === 'choice') {
                return { enum: node.arguments.map(value => {
                    if (!ts.isStringLiteral(value)) {
                        throw Error('Review nonliteral telemetry enum');
                    }
                    return value.text;
                }) };
            }
            if (name === 'nullable' || name === 'array') {
                return { [name]: resolve(node.arguments[0]) };
            }
            if (name === 'rule') {
                return { type: node.typeArguments?.[0]?.getText(source) ?? 'unknown' };
            }
        }
        throw Error(`Unrecognized telemetry schema expression: ${node.getText(source)}`);
    }
    return resolve(bindings.get('eventSchemas'));
}
