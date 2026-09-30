import { describe, expect, it } from 'vitest';
import { SourceRange } from '@/features/search';
import { computeLineHighlightRanges } from './lightweightCodeHighlighter';

describe('computeLineHighlightRanges', () => {
    it('returns empty array when highlightRanges is undefined or empty', () => {
        expect(computeLineHighlightRanges(undefined, 1, 20)).toEqual([]);
        expect(computeLineHighlightRanges([], 1, 20)).toEqual([]);
    });

    it('correctly maps a single-line range on the target line and ignores other lines', () => {
        const ranges: SourceRange[] = [
            {
                start: { lineNumber: 2, column: 5, byteOffset: 4 },
                end: { lineNumber: 2, column: 12, byteOffset: 11 },
            },
        ];

        // Before target line
        expect(computeLineHighlightRanges(ranges, 1, 30)).toEqual([]);

        // On target line: column 5 (0-indexed 4) to column 12 (0-indexed 11)
        expect(computeLineHighlightRanges(ranges, 2, 30)).toEqual([
            { from: 4, to: 11 },
        ]);

        // After target line
        expect(computeLineHighlightRanges(ranges, 3, 30)).toEqual([]);
    });

    it('correctly splits multi-line ranges across start, intermediate, and end lines', () => {
        const multilineRange: SourceRange = {
            start: { lineNumber: 1, column: 15, byteOffset: 14 },
            end: { lineNumber: 3, column: 10, byteOffset: 50 },
        };

        const line1 = 'const handleOrder = async ('; // length 27
        const line2 = '    userId: string,';        // length 19
        const line3 = '    items: CartItem[]';      // length 21
        const line4 = ');';                         // length 2

        // Line 1: Starts at column 15 (0-indexed 14) and highlights to end of line
        expect(computeLineHighlightRanges([multilineRange], 1, line1.length)).toEqual([
            { from: 14, to: line1.length },
        ]);

        // Line 2 (intermediate line): Highlights entire line (0 to length)
        expect(computeLineHighlightRanges([multilineRange], 2, line2.length)).toEqual([
            { from: 0, to: line2.length },
        ]);

        // Line 3 (end line): Highlights from beginning (0) to end column (0-indexed 9)
        expect(computeLineHighlightRanges([multilineRange], 3, line3.length)).toEqual([
            { from: 0, to: 9 },
        ]);

        // Line 4: Outside range
        expect(computeLineHighlightRanges([multilineRange], 4, line4.length)).toEqual([]);
    });

    it('clamps end column to lineLength if end column exceeds line length', () => {
        const range: SourceRange = {
            start: { lineNumber: 1, column: 1, byteOffset: 0 },
            end: { lineNumber: 1, column: 50, byteOffset: 49 },
        };

        expect(computeLineHighlightRanges([range], 1, 20)).toEqual([
            { from: 0, to: 20 },
        ]);
    });

    it('filters out invalid or empty ranges where to <= from', () => {
        const emptyRange: SourceRange = {
            start: { lineNumber: 1, column: 5, byteOffset: 4 },
            end: { lineNumber: 1, column: 5, byteOffset: 4 },
        };

        expect(computeLineHighlightRanges([emptyRange], 1, 20)).toEqual([]);
    });

    it('handles multiple ranges on the same line', () => {
        const ranges: SourceRange[] = [
            {
                start: { lineNumber: 1, column: 1, byteOffset: 0 },
                end: { lineNumber: 1, column: 5, byteOffset: 4 },
            },
            {
                start: { lineNumber: 1, column: 10, byteOffset: 9 },
                end: { lineNumber: 1, column: 15, byteOffset: 14 },
            },
        ];

        expect(computeLineHighlightRanges(ranges, 1, 30)).toEqual([
            { from: 0, to: 4 },
            { from: 9, to: 14 },
        ]);
    });
});
