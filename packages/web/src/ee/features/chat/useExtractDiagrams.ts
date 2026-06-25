'use client';

import { TextUIPart } from "ai";
import { useMemo } from "react";
import { MERMAID_BLOCK_REGEX, getDiagramId } from "./diagramUtils";

export interface ExtractedDiagram {
    id: string;
    code: string;
}

/**
 * Extracts the mermaid diagrams embedded in an answer's text so they can be
 * mirrored in the right panel. Mirrors the approach of useExtractReferences
 * (regex over the message text). Duplicate diagrams (same source) are
 * de-duplicated since they would share an id/anchor.
 */
export const useExtractDiagrams = (part?: TextUIPart): ExtractedDiagram[] => {
    return useMemo(() => {
        if (!part?.text) {
            return [];
        }

        const diagrams: ExtractedDiagram[] = [];
        const seen = new Set<string>();

        // Use a fresh regex instance so the shared lastIndex isn't carried over.
        const regex = new RegExp(MERMAID_BLOCK_REGEX.source, 'g');

        let match;
        while ((match = regex.exec(part.text)) !== null) {
            const code = match[1].trim();
            if (!code) {
                continue;
            }

            const id = getDiagramId(code);
            if (seen.has(id)) {
                continue;
            }

            seen.add(id);
            diagrams.push({ id, code });
        }

        return diagrams;
    }, [part]);
};
