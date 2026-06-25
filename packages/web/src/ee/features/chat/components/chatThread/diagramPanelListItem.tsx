'use client';

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExtractedDiagram } from "@/ee/features/chat/useExtractDiagrams";
import { ChevronDown, ChevronRight, CornerUpLeft, Workflow } from "lucide-react";
import { MermaidDiagram } from "./mermaidDiagram";

interface DiagramPanelListItemProps {
    diagram: ExtractedDiagram;
    index: number;
    isExpanded: boolean;
    isHighlighted: boolean;
    onToggle: () => void;
    onJumpToInline: () => void;
}

export const DiagramPanelListItem = ({
    diagram,
    index,
    isExpanded,
    isHighlighted,
    onToggle,
    onJumpToInline,
}: DiagramPanelListItemProps) => {
    return (
        <div
            id={`diagram-panel-${diagram.id}`}
            className={cn('rounded-md scroll-mt-4 transition-shadow', isHighlighted && 'ring-2 ring-primary')}
        >
            <div className="flex items-center gap-2 border rounded-md px-2 py-1.5 bg-muted/30">
                <button
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    onClick={onToggle}
                    aria-expanded={isExpanded}
                >
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm truncate">{`Diagram ${index + 1}`}</span>
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
                    variant="panel"
                    domId={`diagram-panel-inner-${diagram.id}`}
                    listenToDeepLink={false}
                    className="mt-2 mb-0"
                />
            )}
        </div>
    );
};
