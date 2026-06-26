'use client';

import { createContext, useContext } from "react";

export interface DiagramPanelContextValue {
    // Id of the chat these diagrams belong to, used for analytics.
    chatId: string;
    // Reveal the right-panel mirror of the given diagram (expand it and scroll
    // it into view).
    revealInPanel: (diagramId: string) => void;
    // Zero-based position of the diagram in order of appearance, used as a
    // labeling fallback ("Diagram N"). Returns -1 if unknown.
    getDiagramIndex: (diagramId: string) => number;
    // Sync hover between the inline reference and its right-panel mirror.
    onHoverDiagram: (diagramId: string | undefined) => void;
    // Whether the answer is still streaming. A diagram chip whose source has
    // not yet resolved to a (closed) panel diagram while streaming is the one
    // currently being written, so it shows a shimmer.
    isStreaming: boolean;
}

export const DiagramPanelContext = createContext<DiagramPanelContextValue | null>(null);

export const useDiagramPanel = () => useContext(DiagramPanelContext);
