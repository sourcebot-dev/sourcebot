import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Separator } from "@/components/ui/separator";
import { useDomain } from "@/hooks/useDomain";
import { computePosition, flip, offset, shift, VirtualElement } from "@floating-ui/react";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHoveredOverSymbolInfo } from "./useHoveredOverSymbolInfo";
import { SymbolDefinitionPreview } from "./symbolDefinitionPreview";

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

    const searchParams = useSearchParams();

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

        const params = new URLSearchParams(searchParams.toString());
        params.set('highlightRange', highlightRange);

        router.push(`/${domain}/browse/${repoName}@HEAD/-/blob/${fileName}?${params.toString()}`);
    }, [symbolInfo, searchParams, router, domain]);

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
