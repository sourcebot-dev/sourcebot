import { DiffLine } from "./hunkParser";

export interface SplitRow {
    left: DiffLine | null;
    right: DiffLine | null;
}

// Walk the line list and emit one row per visual position. Context lines
// appear in both columns. Runs of consecutive del/add lines are paired
// index-by-index — leftover rows on the longer side get a blank cell on
// the shorter side.
export const pairForSplit = (lines: DiffLine[]): SplitRow[] => {
    const rows: SplitRow[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.kind === 'context') {
            rows.push({ left: line, right: line });
            i++;
            continue;
        }

        const dels: DiffLine[] = [];
        const adds: DiffLine[] = [];
        while (i < lines.length && lines[i].kind === 'del') {
            dels.push(lines[i++]);
        }
        while (i < lines.length && lines[i].kind === 'add') {
            adds.push(lines[i++]);
        }

        const max = Math.max(dels.length, adds.length);
        for (let k = 0; k < max; k++) {
            rows.push({ left: dels[k] ?? null, right: adds[k] ?? null });
        }
    }
    return rows;
};
