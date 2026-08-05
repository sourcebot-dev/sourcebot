'use client';

import { TextUIPart } from "ai";
import { useMemo } from "react";
import { FileReference, FileSource, Source } from "@/features/chat/types";
import { FILE_REFERENCE_REGEX } from "@/features/chat/constants";
import { createFileReference, tryResolveFileReference } from "@/features/chat/utils";
import { MERMAID_BLOCK_REGEX, getDiagramId } from "./diagramUtils";

export interface ExtractedDiagram {
    id: string;
    code: string;
}

// An ordered entry in the right panel: either a referenced file source or a
// diagram, interleaved by their order of appearance in the answer.
export type PanelItem =
    | { kind: 'source'; source: FileSource }
    | { kind: 'diagram'; diagram: ExtractedDiagram; diagramIndex: number };

export interface ExtractedPanelItems {
    // De-duplicated diagrams, in order of appearance.
    diagrams: ExtractedDiagram[];
    // File sources cited by the answer that resolve against `sources`, deduped.
    referencedFileSources: FileSource[];
    // `referencedFileSources` and `diagrams` interleaved by order of appearance.
    orderedItems: PanelItem[];
}

/**
 * Single-pass extraction of everything the right "evidence" panel renders from
 * an answer's text: the diagrams the model authored and the file sources it
 * cited, interleaved by order of appearance. Consolidates what were previously
 * three separate scans (diagram extraction, referenced-source resolution, and
 * the interleaving scan).
 *
 * @note The diagram id is the content hash (`getDiagramId`); keep it that way —
 * the diagram PostHog events are keyed on it and rely on it being stable across
 * reloads.
 */
export const useExtractPanelItems = (
    part: TextUIPart | undefined,
    references: FileReference[],
    sources: Source[],
): ExtractedPanelItems => {
    return useMemo(() => {
        const text = part?.text ?? '';

        const fileSources = sources.filter((source): source is FileSource => source.type === 'file');

        // The file sources actually cited by the answer, de-duplicated.
        const referencedFileSources = references
            .filter((reference) => reference.type === 'file')
            .map((reference) => tryResolveFileReference(reference, fileSources))
            .filter((file): file is FileSource => file !== undefined)
            .filter((file, index, self) =>
                index === self.findIndex((other) =>
                    other.path === file.path
                    && other.repo === file.repo
                    && other.revision === file.revision
                )
            );

        const diagrams: ExtractedDiagram[] = [];
        const orderedItems: PanelItem[] = [];
        const seenSources = new Set<string>();
        const seenDiagrams = new Set<string>();
        const sourceKey = (source: FileSource) => `${source.repo}::${source.path}::${source.revision}`;

        const combined = new RegExp(`${MERMAID_BLOCK_REGEX.source}|${FILE_REFERENCE_REGEX.source}`, 'g');
        let match: RegExpExecArray | null;
        while ((match = combined.exec(text)) !== null) {
            // match[1]: mermaid body. match[2..5]: file reference repo/path/start/end.
            if (match[1] !== undefined) {
                const code = match[1].trim();
                if (!code) {
                    continue;
                }
                const id = getDiagramId(code);
                if (seenDiagrams.has(id)) {
                    continue;
                }
                seenDiagrams.add(id);
                const diagram = { id, code };
                const diagramIndex = diagrams.length;
                diagrams.push(diagram);
                orderedItems.push({ kind: 'diagram', diagram, diagramIndex });
            } else if (match[2] !== undefined && match[3] !== undefined) {
                const reference = createFileReference({ repo: match[2], path: match[3], startLine: match[4], endLine: match[5] });
                const source = tryResolveFileReference(reference, referencedFileSources);
                if (!source) {
                    continue;
                }
                const key = sourceKey(source);
                if (seenSources.has(key)) {
                    continue;
                }
                seenSources.add(key);
                orderedItems.push({ kind: 'source', source });
            }
        }

        // Safety net: append any resolved source not matched in the scan.
        for (const source of referencedFileSources) {
            const key = sourceKey(source);
            if (!seenSources.has(key)) {
                seenSources.add(key);
                orderedItems.push({ kind: 'source', source });
            }
        }

        return { diagrams, referencedFileSources, orderedItems };
    }, [part, references, sources]);
};
