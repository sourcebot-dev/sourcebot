import type { z } from 'zod';
import type { getDiffResponseSchema } from '@/features/git/schemas';

type DiffResult = z.infer<typeof getDiffResponseSchema>;

export function formatDiffAsGitDiff(result: DiffResult): string {
    let output = '';

    for (const file of result.files) {
        output += file.oldPath ? `--- a/${file.oldPath}\n` : `--- /dev/null\n`;
        output += file.newPath ? `+++ b/${file.newPath}\n` : `+++ /dev/null\n`;

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
