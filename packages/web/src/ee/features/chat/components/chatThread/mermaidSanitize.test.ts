import { expect, test, describe } from 'vitest';
import { sanitizeMermaidCode } from './mermaidSanitize';

describe('sanitizeMermaidCode - styling directives', () => {
    test('strips style, classDef, and linkStyle lines', () => {
        const input = [
            'flowchart TD',
            '    a --> b',
            '    style a fill:#f00',
            '    classDef warning fill:#ff0',
            '    linkStyle 0 stroke:#0f0',
        ].join('\n');

        expect(sanitizeMermaidCode(input)).toBe(['flowchart TD', '    a --> b'].join('\n'));
    });

    test('strips styling directives regardless of leading whitespace', () => {
        const input = ['flowchart TD', 'style a fill:#f00', '\t\tlinkStyle 0 stroke:#0f0'].join('\n');

        expect(sanitizeMermaidCode(input)).toBe('flowchart TD');
    });

    test('does not strip node IDs or labels that merely start with a styling word', () => {
        const input = [
            'flowchart TD',
            '    styleGuide["Style Guide"]',
            '    a["classDef is a keyword"]',
        ].join('\n');

        // No line is removed: the keywords are part of an id / label, not a directive.
        expect(sanitizeMermaidCode(input)).toBe(input);
    });

    test('leaves classDiagram member definitions untouched', () => {
        const input = [
            'classDiagram',
            '    class Animal {',
            '        +int age',
            '    }',
        ].join('\n');

        expect(sanitizeMermaidCode(input)).toBe(input);
    });
});

describe('sanitizeMermaidCode - hallucinated subgraph opener repair', () => {
    test('rewrites a bare `subgbox["Label"]` into a valid subgraph opener', () => {
        const input = '    subgbox["KV v2 Secrets Engine"]';

        expect(sanitizeMermaidCode(input)).toBe('    subgraph subgbox["KV v2 Secrets Engine"]');
    });

    test('preserves the numeric suffix so repaired ids stay unique', () => {
        const input = [
            '    subgbox["One"]',
            '    subgbox2["Two"]',
            '    subgbox3["Three"]',
        ].join('\n');

        expect(sanitizeMermaidCode(input)).toBe(
            [
                '    subgraph subgbox["One"]',
                '    subgraph subgbox2["Two"]',
                '    subgraph subgbox3["Three"]',
            ].join('\n'),
        );
    });

    test('repairs the `(` label form as well as the `[` form', () => {
        const input = '    subgbox("Rounded")';

        expect(sanitizeMermaidCode(input)).toBe('    subgraph subgbox("Rounded")');
    });

    test('leaves an already-valid `subgraph id["Label"]` opener untouched', () => {
        const input = '    subgraph operations["Version Operations"]';

        expect(sanitizeMermaidCode(input)).toBe(input);
    });

    test('does not touch `subgbox` when it is not a subgraph opener', () => {
        // No following `[` or `(`, so it reads as an ordinary token, not an opener.
        const input = '    a --> subgbox';

        expect(sanitizeMermaidCode(input)).toBe(input);
    });

    test('repairs openers and strips styling within the same diagram', () => {
        const input = [
            'flowchart TB',
            '    subgbox["Group A"]',
            '        a1 --> a2',
            '    end',
            '    subgraph two["Group B"]',
            '        b1 --> b2',
            '    end',
            '    style a1 fill:#f00',
        ].join('\n');

        expect(sanitizeMermaidCode(input)).toBe(
            [
                'flowchart TB',
                '    subgraph subgbox["Group A"]',
                '        a1 --> a2',
                '    end',
                '    subgraph two["Group B"]',
                '        b1 --> b2',
                '    end',
            ].join('\n'),
        );
    });
});
