'use client';

import { createContext, useContext } from "react";
import { Reference } from "@/features/chat/types";

// A selectable / hoverable entry that appears in the answer and is mirrored in
// the right "evidence" panel. Unifies file-reference citations and diagrams so
// the panel has a single selection/hover model. New panel item types plug in
// here as additional members.
export type PanelSelection =
    | { kind: 'reference'; reference: Reference }
    | { kind: 'diagram'; diagramId: string };

export interface PanelContextValue {
    // Id of the chat these items belong to, used for analytics.
    chatId: string;
    // Whether the answer is still streaming. A diagram chip whose source has not
    // yet resolved to a (closed) panel diagram while streaming is the one
    // currently being written, so it shows a shimmer.
    isStreaming: boolean;

    // Inline file-reference citations drive selection/hover through these.
    setSelectedReference: (reference?: Reference) => void;
    setHoveredReference: (reference?: Reference) => void;

    // Inline diagram chips drive selection/hover through these. `revealDiagram`
    // re-triggers even when the same diagram is reselected, so re-clicking a
    // chip re-scrolls its panel mirror into view.
    revealDiagram: (diagramId: string) => void;
    setHoveredDiagram: (diagramId?: string) => void;

    // Zero-based position of a diagram in order of appearance, used as a
    // labeling fallback ("Diagram N"). Returns -1 if unknown.
    getDiagramIndex: (diagramId: string) => number;
    // Scroll the inline chip for a diagram into view (panel -> answer).
    jumpToInlineDiagram: (diagramId: string) => void;
}

export const PanelContext = createContext<PanelContextValue | null>(null);

export const usePanelContext = () => useContext(PanelContext);
