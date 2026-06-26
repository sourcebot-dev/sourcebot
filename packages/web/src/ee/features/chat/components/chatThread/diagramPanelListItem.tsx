'use client';

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExtractedDiagram } from "@/ee/features/chat/useExtractDiagrams";
import { ChevronDown, ChevronRight, CornerUpLeft, Workflow } from "lucide-react";
import { MermaidDiagram } from "./mermaidDiagram";
import { getDiagramTitle } from "@/ee/features/chat/diagramUtils";

interface DiagramPanelListItemProps {
    diagram: ExtractedDiagram;
    index: number;
    isExpanded: boolean;
    isHighlighted: boolean;
    isHovered: boolean;
    onToggle: () => void;
    onJumpToInline: () => void;
}

export const DiagramPanelListItem = ({
    diagram,
    index,
    isExpanded,
    isHighlighted,
    isHovered,
    onToggle,
    onJumpToInline,
}: DiagramPanelListItemProps) => {
    const label = getDiagramTitle(diagram.code) ?? `Diagram ${index + 1}`;

    return (
        <div
            id={`diagram-panel-${diagram.id}`}
            className={cn(
                'relative rounded-md overflow-clip scroll-mt-4 transition-shadow',
                isHighlighted ? 'ring-2 ring-primary' : isHovered && 'ring-1 ring-primary/50',
            )}
        >
            <div className={cn(
                'sticky top-0 z-10 flex flex-row items-center bg-accent py-1 px-3 gap-1.5 border-l border-r border-t',
                { 'border-b': !isExpanded },
            )}>
                <button
                    className="flex flex-1 min-w-0 flex-row items-center gap-1.5 text-left"
                    onClick={onToggle}
                    aria-expanded={isExpanded}
                >
                    {isExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0 cursor-pointer" />
                    ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 cursor-pointer" />
                    )}
                    <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm truncate">{label}</span>
                </button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={onJumpToInline}
                    aria-label="Jump to answer"
                >
                    <CornerUpLeft className="h-3 w-3" />
                </Button>
            </div>

            {isExpanded && (
                <MermaidDiagram
                    code={diagram.code}
                    className="my-0 rounded-t-none border-t-0"
                />
            )}
        </div>
    );
};
