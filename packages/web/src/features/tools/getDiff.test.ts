import { describe, it, expect } from 'vitest';
import { GetDiffResult } from '@/features/git';

// Extract the formatting function for testing
function formatDiffAsGitDiff(result: GetDiffResult): string {
    let output = '';

    for (const file of result.files) {
        const oldPath = file.oldPath ?? '/dev/null';
        const newPath = file.newPath ?? '/dev/null';

        output += `--- a/${oldPath}\n`;
        output += `+++ b/${newPath}\n`;

        for (const hunk of file.hunks) {
            const oldStart = hunk.oldRange.start;
            const oldLines = hunk.oldRange.lines;
            const newStart = hunk.newRange.start;
            const newLines = hunk.newRange.lines;

            output += `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@`;
            if (hunk.heading) {
                output += ` ${hunk.heading}`;
            }
            output += '\n';

            output += hunk.body;
            if (!hunk.body.endsWith('\n')) {
                output += '\n';
            }
        }
    }

    return output;
}

describe('formatDiffAsGitDiff', () => {
    it('should format a simple file change correctly', () => {
        const input: GetDiffResult = {
            files: [
                {
                    oldPath: 'file.txt',
                    newPath: 'file.txt',
                    hunks: [
                        {
                            oldRange: { start: 1, lines: 3 },
                            newRange: { start: 1, lines: 4 },
                            heading: undefined,
                            body: ' context line\n-removed line\n+added line\n context line',
                        },
                    ],
                },
            ],
        };

        const expected = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
 context line
-removed line
+added line
 context line
`;

        expect(formatDiffAsGitDiff(input)).toBe(expected);
    });

    it('should handle file deletion', () => {
        const input: GetDiffResult = {
            files: [
                {
                    oldPath: 'deleted.txt',
                    newPath: null,
                    hunks: [
                        {
                            oldRange: { start: 1, lines: 2 },
                            newRange: { start: 0, lines: 0 },
                            heading: undefined,
                            body: '-line 1\n-line 2',
                        },
                    ],
                },
            ],
        };

        const expected = `--- a/deleted.txt
+++ b//dev/null
@@ -1,2 +0,0 @@
-line 1
-line 2
`;

        expect(formatDiffAsGitDiff(input)).toBe(expected);
    });

    it('should handle file addition', () => {
        const input: GetDiffResult = {
            files: [
                {
                    oldPath: null,
                    newPath: 'new.txt',
                    hunks: [
                        {
                            oldRange: { start: 0, lines: 0 },
                            newRange: { start: 1, lines: 2 },
                            heading: undefined,
                            body: '+line 1\n+line 2',
                        },
                    ],
                },
            ],
        };

        const expected = `--- a//dev/null
+++ b/new.txt
@@ -0,0 +1,2 @@
+line 1
+line 2
`;

        expect(formatDiffAsGitDiff(input)).toBe(expected);
    });

    it('should include hunk heading when present', () => {
        const input: GetDiffResult = {
            files: [
                {
                    oldPath: 'code.ts',
                    newPath: 'code.ts',
                    hunks: [
                        {
                            oldRange: { start: 10, lines: 5 },
                            newRange: { start: 10, lines: 6 },
                            heading: 'function myFunction()',
                            body: ' function myFunction() {\n+  console.log("new line");\n   return true;\n }',
                        },
                    ],
                },
            ],
        };

        const expected = `--- a/code.ts
+++ b/code.ts
@@ -10,5 +10,6 @@ function myFunction()
 function myFunction() {
+  console.log("new line");
   return true;
 }
`;

        expect(formatDiffAsGitDiff(input)).toBe(expected);
    });

    it('should handle multiple files', () => {
        const input: GetDiffResult = {
            files: [
                {
                    oldPath: 'file1.txt',
                    newPath: 'file1.txt',
                    hunks: [
                        {
                            oldRange: { start: 1, lines: 1 },
                            newRange: { start: 1, lines: 2 },
                            heading: undefined,
                            body: ' old\n+new',
                        },
                    ],
                },
                {
                    oldPath: 'file2.txt',
                    newPath: 'file2.txt',
                    hunks: [
                        {
                            oldRange: { start: 1, lines: 1 },
                            newRange: { start: 1, lines: 1 },
                            heading: undefined,
                            body: ' unchanged',
                        },
                    ],
                },
            ],
        };

        const expected = `--- a/file1.txt
+++ b/file1.txt
@@ -1,1 +1,2 @@
 old
+new
--- a/file2.txt
+++ b/file2.txt
@@ -1,1 +1,1 @@
 unchanged
`;

        expect(formatDiffAsGitDiff(input)).toBe(expected);
    });

    it('should handle multiple hunks in a single file', () => {
        const input: GetDiffResult = {
            files: [
                {
                    oldPath: 'file.txt',
                    newPath: 'file.txt',
                    hunks: [
                        {
                            oldRange: { start: 1, lines: 2 },
                            newRange: { start: 1, lines: 2 },
                            heading: undefined,
                            body: ' line 1\n+line 2',
                        },
                        {
                            oldRange: { start: 10, lines: 2 },
                            newRange: { start: 11, lines: 2 },
                            heading: undefined,
                            body: '-line 10\n line 11',
                        },
                    ],
                },
            ],
        };

        const expected = `--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,2 @@
 line 1
+line 2
@@ -10,2 +11,2 @@
-line 10
 line 11
`;

        expect(formatDiffAsGitDiff(input)).toBe(expected);
    });
});
