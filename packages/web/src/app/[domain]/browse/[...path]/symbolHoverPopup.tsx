import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { computePosition, flip, offset, shift, VirtualElement } from "@floating-ui/react";
import CodeMirror, { EditorView, minimalSetup, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SymbolDefInfo, useHoveredOverSymbolInfo } from "./useHoveredOverSymbolInfo";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { Button } from "@/components/ui/button";
import { useSyntaxHighlightingExtension } from "@/hooks/useSyntaxHighlightingExtension";
import { createPathWithQueryParams } from "@/lib/utils";
import { useDomain } from "@/hooks/useDomain";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";

interface SymbolHoverPopupProps {
    editorRef: ReactCodeMirrorRef;
    repoName: string;
    onFindReferences: (symbolName: string) => void;
}

export const SymbolHoverPopup: React.FC<SymbolHoverPopupProps> = ({
    editorRef,
    repoName,
    onFindReferences,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isSticky, setIsSticky] = useState(false);
    const domain = useDomain();
    const router = useRouter();

    const symbolInfo = useHoveredOverSymbolInfo({
        editorRef,
        isSticky,
        repoName,
    });

    // Positions the popup relative to the symbol
    useEffect(() => {
        if (!symbolInfo) {
            return;
        }

        const virtualElement: VirtualElement = {
            getBoundingClientRect: () => {
                return symbolInfo.element.getBoundingClientRect();
            }
        }

        if (ref.current) {
            computePosition(virtualElement, ref.current, {
                placement: 'top',
                middleware: [
                    offset(2),
                    flip({
                        mainAxis: true,
                        crossAxis: false,
                        fallbackPlacements: ['bottom'],
                        boundary: editorRef.view?.dom,
                    }),
                    shift({
                        padding: 5,
                    })
                ]
            }).then(({ x, y }) => {
                if (ref.current) {
                    ref.current.style.left = `${x}px`;
                    ref.current.style.top = `${y}px`;
                }
            })
        }
    }, [symbolInfo, editorRef]);

    // If we resolve multiple matches, instead of navigating to the first match, we should
    // instead popup the bottom sheet with the list of matches.
    const onGotoDefinition = useCallback(() => {
        if (!symbolInfo || !symbolInfo.symbolDefInfo) {
            return;
        }

        const { symbolDefInfo } = symbolInfo;
        const { fileName, repoName } = symbolDefInfo;
        const { start, end } = symbolDefInfo.range;
        const highlightRange = `${start.lineNumber}:${start.column},${end.lineNumber}:${end.column}`;

        const url = createPathWithQueryParams(`/${domain}/browse/${repoName}@HEAD/-/blob/${fileName}`,
            ['highlightRange', highlightRange]
        );
        router.push(url);
    }, [symbolInfo, domain, router]);

    // @todo: We should probably make the behaviour s.t., the ctrl / cmd key needs to be held
    // down to navigate to the definition. We should also only show the underline when the key
    // is held, hover is active, and we have found the symbol definition.
    useEffect(() => {
        if (!symbolInfo) {
            return;
        }

        symbolInfo.element.addEventListener("click", onGotoDefinition);
        return () => {
            symbolInfo.element.removeEventListener("click", onGotoDefinition);
        }
    }, [symbolInfo, onGotoDefinition]);

    return symbolInfo ? (
        <div
            ref={ref}
            className="absolute z-10 flex flex-col gap-2 bg-background border border-gray-300 dark:border-gray-700 rounded-md shadow-lg p-2 max-w-3xl"
            onMouseOver={() => setIsSticky(true)}
            onMouseOut={() => setIsSticky(false)}
        >
            {symbolInfo.isSymbolDefInfoLoading ? (
                <div className="flex flex-row items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                </div>
            ) : symbolInfo.symbolDefInfo ? (
                <SymbolDefinitionPreview
                    symbolDefinition={symbolInfo.symbolDefInfo}
                />
            ) : (
                <p className="text-sm font-medium text-muted-foreground">No hover info found</p>
            )}
            <Separator />
            <div className="flex flex-row gap-2 mt-2">
                <LoadingButton
                    loading={symbolInfo.isSymbolDefInfoLoading}
                    disabled={symbolInfo.symbolDefInfo === undefined}
                    variant="outline"
                    size="sm"
                    onClick={onGotoDefinition}
                >
                    {!symbolInfo.isSymbolDefInfoLoading && !symbolInfo.symbolDefInfo ?
                        "No definition found" :
                        "Go to definition"
                    }
                </LoadingButton>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onFindReferences(symbolInfo.symbolName)}
                >
                    Find references
                </Button>
            </div>
        </div>
    ) : null;
};

interface SymbolDefinitionPreviewProps {
    symbolDefinition: SymbolDefInfo;
}

export const SymbolDefinitionPreview = ({
    symbolDefinition,
}: SymbolDefinitionPreviewProps) => {
    const { content: lineContent, language } = symbolDefinition;
    const theme = useCodeMirrorTheme();
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    const syntaxHighlighting = useSyntaxHighlightingExtension(language, editorRef.current?.view);

    const extensions = useMemo(() => {
        return [
            minimalSetup(),
            EditorView.lineWrapping,
            syntaxHighlighting,
        ]
    }, [syntaxHighlighting]);

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
            <CodeMirror
                ref={editorRef}
                value={lineContent}
                extensions={extensions}
                basicSetup={false}
                theme={theme}
            />
        </div>
    )
}