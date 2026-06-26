// Matches fenced ```mermaid code blocks in an answer's markdown.
export const MERMAID_BLOCK_REGEX = /```mermaid\s*\n([\s\S]*?)```/g;

// Stable, deterministic hash of the diagram source so a diagram keeps the same
// id across reloads (the source is persisted in the message) and so the inline
// and right-panel instances of the same diagram resolve to the same id.
const hashString = (value: string): string => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
};

export const getDiagramId = (code: string): string => hashString(code.trim());

// Canonical DOM id / deep-link anchor for the inline instance of a diagram.
export const getDiagramAnchorId = (code: string): string => `diagram-${getDiagramId(code)}`;

const DIAGRAM_TITLE_MAX_LENGTH = 60;

// Extracts the human-readable title the model assigned to a diagram via a
// mermaid YAML frontmatter block at the top of the source, e.g.
//
//   ---
//   title: Authentication Flow
//   ---
//   flowchart TD
//     ...
//
// Tolerant of surrounding quotes and other frontmatter keys (e.g. `config:`).
// Returns undefined when no usable title is present so callers can fall back
// to a generic "Diagram N" label.
export const getDiagramTitle = (code: string): string | undefined => {
    const frontmatterMatch = /^\s*---\s*\n([\s\S]*?)\n---/.exec(code);
    if (!frontmatterMatch) {
        return undefined;
    }

    const titleMatch = /^[ \t]*title:[ \t]*(.+?)[ \t]*$/m.exec(frontmatterMatch[1]);
    if (!titleMatch) {
        return undefined;
    }

    // Strip a single pair of surrounding quotes, if present.
    const title = titleMatch[1].replace(/^(['"])(.*)\1$/, '$2').trim();
    if (!title) {
        return undefined;
    }

    return title.length > DIAGRAM_TITLE_MAX_LENGTH
        ? `${title.slice(0, DIAGRAM_TITLE_MAX_LENGTH - 1).trimEnd()}…`
        : title;
};
