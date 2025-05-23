import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LightweightCodeHighlighter } from "@/app/[domain]/components/lightweightCodeHighlighter";
import { SymbolDefInfo } from "./useHoveredOverSymbolInfo";
import { useMemo } from "react";

interface SymbolDefinitionPreviewProps {
    symbolDefinition: SymbolDefInfo;
}

export const SymbolDefinitionPreview = ({
    symbolDefinition,
}: SymbolDefinitionPreviewProps) => {
    const { content: lineContent, language, range } = symbolDefinition;
    const highlightRanges = useMemo(() => [range], [range]);

    return (
        <div className="flex flex-col gap-2 mb-2">
            <Tooltip
                delayDuration={100}
            >
                <TooltipTrigger
                    disabled={true}
                    className="mr-auto"
                >
                    <Badge
                        variant="outline"
                        className="w-fit h-fit flex-shrink-0 select-none"
                    >
                        Search Based
                    </Badge>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    align="start"
                >
                    Symbol definition found using a best-guess search heuristic.
                </TooltipContent>
            </Tooltip>
            <LightweightCodeHighlighter
                language={language}
                highlightRanges={highlightRanges}
                lineNumbers={false}
                lineNumbersOffset={range.start.lineNumber}
                removeTrailingNewline={true}
                renderWhitespace={false}
            >
                {lineContent}
            </LightweightCodeHighlighter>
        </div>
    )
}