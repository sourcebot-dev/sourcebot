'use client';

import { createContext, useContext } from "react";

export interface DiagramPanelContextValue {
    // Reveal the right-panel mirror of the given diagram (expand it and scroll
    // it into view).
    revealInPanel: (diagramId: string) => void;
}

export const DiagramPanelContext = createContext<DiagramPanelContextValue | null>(null);

export const useDiagramPanel = () => useContext(DiagramPanelContext);
