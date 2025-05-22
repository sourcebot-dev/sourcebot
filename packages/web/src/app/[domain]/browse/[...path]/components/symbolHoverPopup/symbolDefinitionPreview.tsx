import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReadOnlyCodeBlock } from "@/app/[domain]/components/readOnlyCodeBlock";
import { SymbolDefInfo } from "./useHoveredOverSymbolInfo";

interface SymbolDefinitionPreviewProps {
    symbolDefinition: SymbolDefInfo;
}

export const SymbolDefinitionPreview = ({
    symbolDefinition,
}: SymbolDefinitionPreviewProps) => {
    const { content: lineContent, language, range } = symbolDefinition;

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
            <ReadOnlyCodeBlock
                language={language}
                highlightRanges={[
                    {
                        from: range.start.column - 1,
                        to: range.end.column - 1,
                    }
                ]}
            >
                {lineContent}
            </ReadOnlyCodeBlock>
        </div>
    )
}