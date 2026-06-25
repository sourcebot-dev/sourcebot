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
