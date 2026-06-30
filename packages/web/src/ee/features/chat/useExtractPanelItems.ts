'use client';

import { TextUIPart } from "ai";
import { useMemo } from "react";
import { AttachmentData, FileSource, Reference, Source } from "@/features/chat/types";
import { ATTACHMENT_REFERENCE_REGEX, FILE_REFERENCE_REGEX } from "@/features/chat/constants";
import { createFileReference, tryResolveFileReference } from "@/features/chat/utils";
import { MERMAID_BLOCK_REGEX, getDiagramId } from "./diagramUtils";

export interface ExtractedDiagram {
    id: string;
    code: string;
}

// A cited text attachment, resolved to the content the panel renders. Mirrors
// FileSource for files, but the content travels inline (no fetch).
export interface ReferencedAttachment {
    attachmentId: string;
    filename: string;
    mediaType: string;
    text: string;
}

// An ordered entry in the right panel: a referenced file source, a referenced
// attachment, or a diagram, interleaved by their order of appearance.
export type PanelItem =
    | { kind: 'source'; source: FileSource }
    | { kind: 'attachment'; attachment: ReferencedAttachment }
    | { kind: 'diagram'; diagram: ExtractedDiagram; diagramIndex: number };

export interface ExtractedPanelItems {
    // De-duplicated diagrams, in order of appearance.
    diagrams: ExtractedDiagram[];
    // File sources cited by the answer that resolve against `sources`, deduped.
    referencedFileSources: FileSource[];
    // Attachments cited by the answer that resolve against `attachments`, deduped.
    referencedAttachments: ReferencedAttachment[];
    // `referencedFileSources`, `referencedAttachments`, and `diagrams`
    // interleaved by order of appearance.
    orderedItems: PanelItem[];
}

// Builds the id -> attachment lookup the answer's @attachment references resolve
// against. Only text attachments are renderable as evidence (each carries a
// stable id from creation), so non-text attachments are filtered out.
const buildAttachmentIndex = (attachments: AttachmentData[]): Map<string, ReferencedAttachment> => {
    const index = new Map<string, ReferencedAttachment>();
    for (const attachment of attachments) {
        if (attachment.kind === 'text') {
            index.set(attachment.id, {
                attachmentId: attachment.id,
                filename: attachment.filename,
                mediaType: attachment.mediaType,
                text: attachment.text,
            });
        }
    }
    return index;
};

/**
 * Single-pass extraction of everything the right "evidence" panel renders from
 * an answer's text: the diagrams the model authored, the file sources it cited,
 * and the attachments it cited, interleaved by order of appearance.
 *
 * Attachments resolve against the chat-wide `attachments` list (their content
 * is inline in the message history), so a citation to an attachment from any
 * earlier turn still resolves.
 *
 * @note The diagram id is the content hash (`getDiagramId`); keep it that way -
 * the diagram PostHog events are keyed on it and rely on it being stable across
 * reloads.
 */
export const useExtractPanelItems = (
    part: TextUIPart | undefined,
    references: Reference[],
    sources: Source[],
    attachments: AttachmentData[] = [],
): ExtractedPanelItems => {
    return useMemo(() => {
        const text = part?.text ?? '';

        const fileSources = sources.filter((source): source is FileSource => source.type === 'file');
        const attachmentIndex = buildAttachmentIndex(attachments);

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

        // The attachments actually cited by the answer, de-duplicated.
        const referencedAttachments = references
            .filter((reference) => reference.type === 'attachment')
            .map((reference) => attachmentIndex.get(reference.attachmentId))
            .filter((attachment): attachment is ReferencedAttachment => attachment !== undefined)
            .filter((attachment, index, self) =>
                index === self.findIndex((other) => other.attachmentId === attachment.attachmentId)
            );

        const diagrams: ExtractedDiagram[] = [];
        const orderedItems: PanelItem[] = [];
        const seenSources = new Set<string>();
        const seenAttachments = new Set<string>();
        const seenDiagrams = new Set<string>();
        const sourceKey = (source: FileSource) => `${source.repo}::${source.path}::${source.revision}`;

        const combined = new RegExp(
            `${MERMAID_BLOCK_REGEX.source}|${FILE_REFERENCE_REGEX.source}|${ATTACHMENT_REFERENCE_REGEX.source}`,
            'g',
        );
        let match: RegExpExecArray | null;
        while ((match = combined.exec(text)) !== null) {
            // match[1]: mermaid body. match[2..5]: file reference repo/path/start/end.
            // match[6..8]: attachment reference id/start/end.
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
            } else if (match[6] !== undefined) {
                const attachment = attachmentIndex.get(match[6]);
                if (!attachment || seenAttachments.has(attachment.attachmentId)) {
                    continue;
                }
                seenAttachments.add(attachment.attachmentId);
                orderedItems.push({ kind: 'attachment', attachment });
            }
        }

        // Safety net: append any resolved source/attachment not matched in the scan.
        for (const source of referencedFileSources) {
            const key = sourceKey(source);
            if (!seenSources.has(key)) {
                seenSources.add(key);
                orderedItems.push({ kind: 'source', source });
            }
        }
        for (const attachment of referencedAttachments) {
            if (!seenAttachments.has(attachment.attachmentId)) {
                seenAttachments.add(attachment.attachmentId);
                orderedItems.push({ kind: 'attachment', attachment });
            }
        }

        return { diagrams, referencedFileSources, referencedAttachments, orderedItems };
    }, [part, references, sources, attachments]);
};
