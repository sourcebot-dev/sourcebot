import { describe, expect, test } from 'vitest';
import { ARTIFACT_READ_MAX_LINES, readArtifactContent } from './artifactReader';

describe('readArtifactContent', () => {
    test('numbers lines, wraps content, and appends the end-of-file note', () => {
        const result = readArtifactContent({ content: 'a\nb\nc', header: '<h>x</h>' });

        expect(result.output).toContain('<h>x</h>\n<content>\n');
        expect(result.output).toContain('1: a');
        expect(result.output).toContain('2: b');
        expect(result.output).toContain('3: c');
        expect(result.output).toContain('(End of file - 3 lines total)');
        expect(result.output.endsWith('</content>')).toBe(true);
        expect(result).toMatchObject({ startLine: 1, endLine: 3, isTruncated: false, totalLines: 3 });
    });

    test('respects offset and limit and reports the continuation offset', () => {
        const content = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n');

        const result = readArtifactContent({ content, header: '<h/>', offset: 3, limit: 2 });

        expect(result.startLine).toBe(3);
        expect(result.endLine).toBe(4);
        expect(result.isTruncated).toBe(true);
        expect(result.output).toContain('3: line3');
        expect(result.output).toContain('4: line4');
        expect(result.output).not.toContain('5: line5');
        expect(result.output).toContain('Use offset=5 to continue');
    });

    test('caps the number of lines read at ARTIFACT_READ_MAX_LINES', () => {
        const content = Array.from({ length: ARTIFACT_READ_MAX_LINES + 50 }, (_, i) => `l${i}`).join('\n');

        const result = readArtifactContent({ content, header: '<h/>', limit: 100000 });

        expect(result.endLine).toBe(ARTIFACT_READ_MAX_LINES);
        expect(result.isTruncated).toBe(true);
    });

    test('reports an empty result for an offset past EOF instead of an inverted range', () => {
        const result = readArtifactContent({ content: 'a\nb\nc', header: '<h/>', offset: 10 });

        expect(result.startLine).toBeLessThanOrEqual(result.endLine);
        expect(result.isTruncated).toBe(false);
        expect(result.totalLines).toBe(3);
        expect(result.output).toContain('No lines to read');
        expect(result.output).not.toMatch(/Use offset=\d+ to continue/);
        expect(result.output.endsWith('</content>')).toBe(true);
    });

    test('always admits the first line even when it alone exceeds the byte budget', () => {
        // 3-byte chars so the byte budget is exceeded even after the per-line
        // character cap (2000 chars × 3 bytes ≈ 6KB > 5KB).
        const oversizedLine = '€'.repeat(3000);

        const result = readArtifactContent({ content: oversizedLine, header: '<h/>' });

        expect(result.startLine).toBe(1);
        expect(result.endLine).toBe(1);
        expect(result.output).toContain('1: ');
        expect(result.output).not.toMatch(/Use offset=\d+ to continue/);
    });

    test('handles empty content as a single empty line', () => {
        const result = readArtifactContent({ content: '', header: '<h/>' });

        expect(result).toMatchObject({ startLine: 1, endLine: 1, isTruncated: false, totalLines: 1 });
        expect(result.output).toContain('(End of file - 1 lines total)');
    });
});
