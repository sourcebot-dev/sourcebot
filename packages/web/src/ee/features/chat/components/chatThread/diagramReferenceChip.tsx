'use client';

import { cn } from '@/lib/utils';
import { Workflow } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getDiagramAnchorId, getDiagramId, getDiagramTitle } from '@/ee/features/chat/diagramUtils';
import { useDiagramPanel } from '@/ee/features/chat/diagramPanelContext';
import { AnimatedShinyText } from '@/components/ui/animatedShinyText';

interface DiagramReferenceChipProps {
    code: string;
}

/**
 * Inline, in-answer reference to a diagram. The full diagram is rendered in the
 * right "evidence" panel; here we render a compact button (mirroring the
 * file-reference chips) that scrolls to and focuses the panel diagram on click,
 * and highlights it on hover. The raw mermaid fence in the answer text is
 * untouched, so copying the answer still yields a valid mermaid code block.
 */
export const DiagramReferenceChip = ({ code }: DiagramReferenceChipProps) => {
    const diagramPanel = useDiagramPanel();
    const containerRef = useRef<HTMLButtonElement>(null);

    const diagramId = useMemo(() => getDiagramId(code), [code]);
    const anchorId = useMemo(() => getDiagramAnchorId(code), [code]);

    const index = diagramPanel?.getDiagramIndex(diagramId) ?? -1;

    // While streaming, a chip whose source has not yet resolved to a (closed)
    // panel diagram is the one currently being written: show a shimmer so the
    // turn doesn't look stalled.
    const isGenerating = (diagramPanel?.isStreaming ?? false) && index < 0;

    const label = useMemo(() => {
        if (isGenerating) {
            return 'Generating diagram…';
        }
        const title = getDiagramTitle(code);
        if (title) {
            return title;
        }
        return index >= 0 ? `Diagram ${index + 1}` : 'Diagram';
    }, [code, index, isGenerating]);

    const reveal = useCallback(() => {
        diagramPanel?.revealInPanel(diagramId);
    }, [diagramPanel, diagramId]);

    // Shared in-thread deep links target the inline anchor (`#diagram-<id>`).
    // When the hash matches, scroll the chip into view and reveal the full
    // diagram in the panel.
    useEffect(() => {
        const checkHash = () => {
            if (typeof window === 'undefined' || window.location.hash !== `#${anchorId}`) {
                return;
            }
            containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            diagramPanel?.revealInPanel(diagramId);
        };

        checkHash();
        window.addEventListener('hashchange', checkHash);
        return () => window.removeEventListener('hashchange', checkHash);
    }, [anchorId, diagramId, diagramPanel]);

    return (
        <button
            ref={containerRef}
            id={anchorId}
            type="button"
            className={cn(
                'not-prose my-4 flex w-fit items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5',
                'text-sm text-foreground transition-colors scroll-mt-16 cursor-pointer hover:bg-muted',
            )}
            onClick={reveal}
            onMouseEnter={() => diagramPanel?.onHoverDiagram(diagramId)}
            onMouseLeave={() => diagramPanel?.onHoverDiagram(undefined)}
            title={isGenerating ? undefined : 'Click to view diagram'}
        >
            <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" />
            {isGenerating ? (
                <AnimatedShinyText className="truncate">{label}</AnimatedShinyText>
            ) : (
                <span className="truncate">{label}</span>
            )}
        </button>
    );
};
