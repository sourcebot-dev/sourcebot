import { describe, expect, test, vi } from 'vitest';
import { readFileTool } from './readFile';

vi.mock('@/features/git', () => ({
    getFileSource: vi.fn(),
}));

vi.mock('../logger', () => ({
    logger: { debug: vi.fn() },
}));

vi.mock('./readFile.txt', () => ({ default: 'description' }));

import { getFileSource } from '@/features/git';

const mockGetFileSource = vi.mocked(getFileSource);

function makeSource(source: string) {
    mockGetFileSource.mockResolvedValue({
        source,
        path: 'test.ts',
        repo: 'github.com/org/repo',
        language: 'typescript',
        revision: 'HEAD',
    } as any);
}

describe('readFileTool byte cap', () => {
    test('truncates output at 5KB and shows byte cap message', async () => {
        // Each line is ~100 bytes; 60 lines = ~6KB, over the 5KB cap
        const lines = Array.from({ length: 60 }, (_, i) => `line${i + 1}: ${'x'.repeat(90)}`).join('\n');
        makeSource(lines);

        const result = await readFileTool.execute!({ path: 'test.ts', repository: 'github.com/org/repo' }, {} as any);
        expect('source' in result && result.source).toContain('Output capped at 5KB');
        expect('source' in result && result.source).toContain('Use offset=');
        expect('source' in result && result.source).toContain('Output capped at 5KB');
    });

    test('does not cap output under 5KB', async () => {
        makeSource('short line\n'.repeat(10).trimEnd());

        const result = await readFileTool.execute!({ path: 'test.ts', repository: 'github.com/org/repo' }, {} as any);
        expect('source' in result && result.source).not.toContain('Output capped at 5KB');
    });
});

describe('readFileTool hasMoreLines message', () => {
    test('appends continuation message when file is truncated', async () => {
        const lines = Array.from({ length: 600 }, (_, i) => `line${i + 1}`).join('\n');
        makeSource(lines);

        const result = await readFileTool.execute!({ path: 'test.ts', repository: 'github.com/org/repo' }, {} as any);
        expect('source' in result && result.source).toContain('Showing lines 1-500 of 600');
        expect('source' in result && result.source).toContain('offset=501');
    });

    test('shows end of file message when all lines fit', async () => {
        makeSource('line1\nline2\nline3');

        const result = await readFileTool.execute!({ path: 'test.ts', repository: 'github.com/org/repo' }, {} as any);
        expect('source' in result && result.source).not.toContain('Showing lines');
        expect('source' in result && result.source).toContain('End of file - 3 lines total');
    });

    test('continuation message reflects offset parameter', async () => {
        const lines = Array.from({ length: 600 }, (_, i) => `line${i + 1}`).join('\n');
        makeSource(lines);

        const result = await readFileTool.execute!({ path: 'test.ts', repository: 'github.com/org/repo', offset: 100 }, {} as any);
        expect('source' in result && result.source).toContain('Showing lines 100-599 of 600');
        expect('source' in result && result.source).toContain('offset=600');
    });
});

describe('readFileTool line truncation', () => {
    test('does not truncate lines under the limit', async () => {
        const line = 'x'.repeat(100);
        makeSource(line);

        const result = await readFileTool.execute!({ path: 'test.ts', repository: 'github.com/org/repo' }, {} as any);
        expect('source' in result && result.source).toContain(line);
        expect('source' in result && result.source).not.toContain('line truncated');
    });

    test('truncates lines longer than 2000 chars', async () => {
        const line = 'x'.repeat(3000);
        makeSource(line);

        const result = await readFileTool.execute!({ path: 'test.ts', repository: 'github.com/org/repo' }, {} as any);
        expect('source' in result && result.source).toContain('... (line truncated to 2000 chars)');
        expect('source' in result && result.source).not.toContain('x'.repeat(2001));
    });

    test('truncates only the long lines, leaving normal lines intact', async () => {
        const longLine = 'a'.repeat(3000);
        const normalLine = 'normal line';
        makeSource(`${normalLine}\n${longLine}\n${normalLine}`);

        const result = await readFileTool.execute!({ path: 'test.ts', repository: 'github.com/org/repo' }, {} as any);
        expect('source' in result && result.source).toContain(normalLine);
        expect('source' in result && result.source).toContain('... (line truncated to 2000 chars)');
    });

    test('truncates a line at exactly 2001 chars', async () => {
        makeSource('b'.repeat(2001));

        const result = await readFileTool.execute!({ path: 'test.ts', repository: 'github.com/org/repo' }, {} as any);
        expect('source' in result && result.source).toContain('... (line truncated to 2000 chars)');
    });

    test('does not truncate a line at exactly 2000 chars', async () => {
        makeSource('c'.repeat(2000));

        const result = await readFileTool.execute!({ path: 'test.ts', repository: 'github.com/org/repo' }, {} as any);
        expect('source' in result && result.source).not.toContain('line truncated');
    });
});
