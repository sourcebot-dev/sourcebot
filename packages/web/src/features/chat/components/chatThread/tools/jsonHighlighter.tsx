'use client';

export function unescapeJsonStrings(value: unknown): unknown {
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            if (typeof parsed === 'object' && parsed !== null) {
                return unescapeJsonStrings(parsed);
            }
        } catch {
            // not JSON — leave as-is
        }
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(unescapeJsonStrings);
    }
    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, unescapeJsonStrings(v)])
        );
    }
    return value;
}

type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'structural' | 'whitespace' | 'other';

interface Token {
    type: TokenType;
    value: string;
}

function tokenizeJson(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < text.length) {
        const ch = text[i];

        // Whitespace
        if (/\s/.test(ch)) {
            let j = i + 1;
            while (j < text.length && /\s/.test(text[j])) {
                j++;
            }
            tokens.push({ type: 'whitespace', value: text.slice(i, j) });
            i = j;
            continue;
        }

        // String
        if (ch === '"') {
            let j = i + 1;
            while (j < text.length) {
                if (text[j] === '\\') {
                    j += 2;
                } else if (text[j] === '"') {
                    j++;
                    break;
                } else {
                    j++;
                }
            }
            const str = text.slice(i, j);

            // Lookahead past whitespace for a colon → this is a key
            let k = j;
            while (k < text.length && /\s/.test(text[k])) {
                k++;
            }
            const isKey = text[k] === ':';

            tokens.push({ type: isKey ? 'key' : 'string', value: str });
            i = j;
            continue;
        }

        // Number
        if (ch === '-' || /\d/.test(ch)) {
            const match = text.slice(i).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
            if (match) {
                tokens.push({ type: 'number', value: match[0] });
                i += match[0].length;
                continue;
            }
        }

        // Boolean / null keywords
        if (text.slice(i, i + 4) === 'true') {
            tokens.push({ type: 'boolean', value: 'true' });
            i += 4;
            continue;
        }
        if (text.slice(i, i + 5) === 'false') {
            tokens.push({ type: 'boolean', value: 'false' });
            i += 5;
            continue;
        }
        if (text.slice(i, i + 4) === 'null') {
            tokens.push({ type: 'null', value: 'null' });
            i += 4;
            continue;
        }

        // Structural characters
        if ('{}[]:,'.includes(ch)) {
            tokens.push({ type: 'structural', value: ch });
            i++;
            continue;
        }

        // Fallback
        tokens.push({ type: 'other', value: ch });
        i++;
    }

    return tokens;
}

const TOKEN_CLASSES: Record<TokenType, string> = {
    key: 'text-editor-tag-name',
    string: 'text-editor-tag-string',
    number: 'text-editor-tag-number',
    boolean: 'text-editor-tag-atom',
    null: 'text-editor-tag-atom',
    structural: 'text-muted-foreground',
    whitespace: '',
    other: '',
};

import { useMemo } from "react";

export const JsonHighlighter = ({ text }: { text: string }) => {
    const tokens = useMemo(() => tokenizeJson(text), [text]);

    return (
        <pre className="whitespace-pre-wrap break-all font-mono">
            {tokens.map((token, i) => {
                const cls = TOKEN_CLASSES[token.type];
                if (!cls) {
                    return token.value;
                }
                return (
                    <span key={i} className={cls}>
                        {token.value}
                    </span>
                );
            })}
        </pre>
    );
};
