// Shared reader core for tools that page through a text artifact's content
// (e.g. `read_file`, `read_attachment`). It owns line slicing, the per-line
// length cap, the byte budget, the truncation/continuation hints, and 1-indexed
// line numbering. The tool interfaces stay separate and narrow; only this
// mechanism is shared. Each caller supplies a kind-specific header (the lines
// before `<content>`) and builds its own metadata/sources from the result.

export const ARTIFACT_READ_MAX_LINES = 500;
const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;
const MAX_BYTES = 5 * 1024;
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024}KB`;

export interface ReadArtifactContentResult {
    // The full tool output: the header, the `<content>` block with numbered
    // lines, and a trailing truncation/end-of-file note.
    output: string;
    startLine: number;
    endLine: number;
    isTruncated: boolean;
    totalLines: number;
}

export const readArtifactContent = ({
    content,
    header,
    offset,
    limit,
}: {
    content: string;
    // Lines rendered before the `<content>` block (e.g. `<repo>`/`<path>` for a
    // file, `<filename>`/`<media-type>` for an attachment).
    header: string;
    offset?: number;
    limit?: number;
}): ReadArtifactContentResult => {
    const lines = content.split('\n');
    const start = (offset ?? 1) - 1;
    const end = start + Math.min(limit ?? ARTIFACT_READ_MAX_LINES, ARTIFACT_READ_MAX_LINES);

    const startLine = (offset ?? 1);

    let bytes = 0;
    let truncatedByBytes = false;
    const slicedLines: string[] = [];
    for (const raw of lines.slice(start, end)) {
        const line = raw.length > MAX_LINE_LENGTH ? raw.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX : raw;
        const size = Buffer.byteLength(line, 'utf-8') + (slicedLines.length > 0 ? 1 : 0);
        // Always admit the first line, even if it alone exceeds the byte budget,
        // so an oversized leading line can't stall paging on the same offset.
        if (slicedLines.length > 0 && bytes + size > MAX_BYTES) {
            truncatedByBytes = true;
            break;
        }
        slicedLines.push(line);
        bytes += size;
    }

    // The slice is only empty when offset is past EOF (the first line is always
    // admitted above). Report it explicitly rather than emitting an inverted
    // range or an offset that would stall a retrying caller.
    if (slicedLines.length === 0) {
        return {
            output: `${header}\n<content>\n(No lines to read: offset ${startLine} is past the end of the ${lines.length}-line artifact.)\n</content>`,
            startLine,
            endLine: startLine,
            isTruncated: false,
            totalLines: lines.length,
        };
    }

    const truncatedByLines = end < lines.length;
    const lastReadLine = startLine + slicedLines.length - 1;
    const nextOffset = lastReadLine + 1;

    let output = `${header}\n<content>\n`;
    output += slicedLines.map((line, i) => `${startLine + i}: ${line}`).join('\n');

    if (truncatedByBytes) {
        output += `\n\n(Output capped at ${MAX_BYTES_LABEL}. Showing lines ${startLine}-${lastReadLine} of ${lines.length}. Use offset=${nextOffset} to continue.)`;
    } else if (truncatedByLines) {
        output += `\n\n(Showing lines ${startLine}-${lastReadLine} of ${lines.length}. Use offset=${nextOffset} to continue.)`;
    } else {
        output += `\n\n(End of file - ${lines.length} lines total)`;
    }

    output += `\n</content>`;

    return {
        output,
        startLine,
        endLine: lastReadLine,
        isTruncated: truncatedByBytes || truncatedByLines,
        totalLines: lines.length,
    };
};
