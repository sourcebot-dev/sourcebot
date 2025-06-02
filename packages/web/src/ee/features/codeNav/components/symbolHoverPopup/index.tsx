import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Separator } from "@/components/ui/separator";
import { computePosition, flip, offset, shift, VirtualElement } from "@floating-ui/react";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SymbolDefinition, useHoveredOverSymbolInfo } from "./useHoveredOverSymbolInfo";
import { SymbolDefinitionPreview } from "./symbolDefinitionPreview";
import { createPortal } from "react-dom";

interface SymbolHoverPopupProps {
    editorRef: ReactCodeMirrorRef;
    language: string;
    revisionName: string;
    onFindReferences: (symbolName: string) => void;
    onGotoDefinition: (symbolName: string, symbolDefinitions: SymbolDefinition[]) => void;
}

export const SymbolHoverPopup: React.FC<SymbolHoverPopupProps> = ({
    editorRef,
    revisionName,
    language,
    onFindReferences,
    onGotoDefinition: _onGotoDefinition,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isSticky, setIsSticky] = useState(false);

    const symbolInfo = useHoveredOverSymbolInfo({
        editorRef,
        isSticky,
        revisionName,
        language,
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
                        padding: 20,
                    }),
                    shift({
                        padding: 5,
                        boundary: editorRef.view?.dom,
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

    const onGotoDefinition = useCallback(() => {
        if (!symbolInfo || !symbolInfo.symbolDefinitions) {
            return;
        }

        _onGotoDefinition(symbolInfo.symbolName, symbolInfo.symbolDefinitions);
    }, [symbolInfo, _onGotoDefinition]);

    // @todo: We should probably make the behaviour s.t., the ctrl / cmd key needs to be held
    // down to navigate to the definition. We should also only show the underline when the key
    // is held, hover is active, and we have found the symbol definition.
    useEffect(() => {
        if (!symbolInfo || !symbolInfo.symbolDefinitions) {
            return;
        }

        symbolInfo.element.addEventListener("click", onGotoDefinition);
        return () => {
            symbolInfo.element.removeEventListener("click", onGotoDefinition);
        }
    }, [symbolInfo, onGotoDefinition]);

    if (!symbolInfo) {
        return null;
    }

    // We use a portal here to render the popup at the document body level.
    // This avoids clipping issues that occur when the popup is rendered inside scrollable or overflow-hidden containers (like the editor or its parent).
    // By rendering in a portal, the popup can be absolutely positioned anywhere in the viewport without being cut off by parent containers.
    return createPortal(
        <div
            ref={ref}
            className="absolute z-10 flex flex-col gap-2 bg-background border border-gray-300 dark:border-gray-700 rounded-md shadow-lg p-2 max-w-3xl"
            onMouseOver={() => setIsSticky(true)}
            onMouseOut={() => setIsSticky(false)}
        >
            {symbolInfo.isSymbolDefinitionsLoading ? (
                <div className="flex flex-row items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                </div>
            ) : symbolInfo.symbolDefinitions && symbolInfo.symbolDefinitions.length > 0 ? (
                <SymbolDefinitionPreview
                    symbolDefinition={symbolInfo.symbolDefinitions[0]}
                />
            ) : (
                <p className="text-sm font-medium text-muted-foreground">No hover info found</p>
            )}
            <Separator />
            <div className="flex flex-row gap-2 mt-2">
                <LoadingButton
                    loading={symbolInfo.isSymbolDefinitionsLoading}
                    disabled={!symbolInfo.symbolDefinitions || symbolInfo.symbolDefinitions.length === 0}
                    variant="outline"
                    size="sm"
                    onClick={onGotoDefinition}
                >
                    {
                        !symbolInfo.isSymbolDefinitionsLoading && (!symbolInfo.symbolDefinitions || symbolInfo.symbolDefinitions.length === 0) ?
                            "No definition found" :
                            `Go to ${symbolInfo.symbolDefinitions && symbolInfo.symbolDefinitions.length > 1 ? "definitions" : "definition"}`
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
        </div>,
        document.body
    );
};
