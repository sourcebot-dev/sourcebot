import { DiffHunk } from "@/features/git";

export type LineKind = 'add' | 'del' | 'context';

export interface DiffLine {
    kind: LineKind;
    content: string;
    oldLineNumber?: number;
    newLineNumber?: number;
}

export const parseHunkLines = (hunk: DiffHunk): DiffLine[] => {
    const lines: DiffLine[] = [];
    let oldLine = hunk.oldRange.start;
    let newLine = hunk.newRange.start;

    for (const raw of hunk.body.split('\n')) {
        const prefix = raw[0];
        const content = raw.slice(1);
        if (prefix === '+') {
            lines.push({ kind: 'add', content, newLineNumber: newLine++ });
        } else if (prefix === '-') {
            lines.push({ kind: 'del', content, oldLineNumber: oldLine++ });
        } else {
            // Treat anything else (space prefix or empty body line) as context.
            lines.push({
                kind: 'context',
                content,
                oldLineNumber: oldLine++,
                newLineNumber: newLine++,
            });
        }
    }
    return lines;
};
