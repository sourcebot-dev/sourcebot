import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computePosition, flip, offset, shift, VirtualElement } from "@floating-ui/react";
import { search } from "@/app/api/(client)/client";
import { useDomain } from "@/hooks/useDomain";
import { base64Decode, isServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import CodeMirror, { EditorView, minimalSetup, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import escapeStringRegexp from "escape-string-regexp";


interface SymbolHoverPopupProps {
    editorRef: ReactCodeMirrorRef;
    repoName: string;
}

export const SymbolHoverPopup: React.FC<SymbolHoverPopupProps> = ({
    editorRef,
    repoName
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isSticky, setIsSticky] = useState(false);

    const symbolInfo = useHoveredOverSymbolInfo({
        editorRef,
        isSticky,
        repoName,
    });

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
            ) :
                symbolInfo.symbolDefInfo ? (
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
                            <TooltipContent>
                                Search based on the symbol name.
                            </TooltipContent>
                        </Tooltip>
                        <CodeMirror
                            value={symbolInfo.symbolDefInfo.lineContent}
                            extensions={[
                                minimalSetup(),
                                // @todo: this will need to depend on the language of the file
                                javascript({ jsx: false, typescript: true }),
                                EditorView.lineWrapping,
                            ]}
                            basicSetup={false}
                        />
                    </div>
                ) : (
                    <p className="text-sm font-medium text-muted-foreground">No hover info found</p>
                )}
            <Separator />
            <div className="flex flex-row gap-2 mt-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        console.log("todo: find definition");
                    }}
                >
                    Find definition
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        console.log("todo: find references");
                    }}
                >
                    Find references
                </Button>
            </div>
        </div>
    ) : null;
};

interface UseHoveredOverSymbolInfoProps {
    editorRef: ReactCodeMirrorRef;
    isSticky: boolean;
    repoName: string;
}

interface HoveredOverSymbolInfo {
    element: HTMLElement;
    symbolName: string;
    isSymbolDefInfoLoading: boolean;
    symbolDefInfo?: {
        lineContent: string;
    }
}

const SYMBOL_HOVER_POPUP_MOUSE_OVER_TIMEOUT = 500;
const SYMBOL_HOVER_POPUP_MOUSE_OUT_TIMEOUT = 100;

const useHoveredOverSymbolInfo = ({
    editorRef,
    isSticky,
    repoName,
}: UseHoveredOverSymbolInfoProps): HoveredOverSymbolInfo | undefined => {
    const mouseOverTimerRef = useRef<NodeJS.Timeout | null>(null);
    const mouseOutTimerRef = useRef<NodeJS.Timeout | null>(null);

    const domain = useDomain();
    const [isVisible, setIsVisible] = useState(false);

    const [symbolElement, setSymbolElement] = useState<HTMLElement | null>(null);
    const symbolName = useMemo(() => {
        return (symbolElement && symbolElement.textContent) ?? undefined;
    }, [symbolElement]);

    const { data, isPending: isSymbolDefinitionLoading } = useQuery({
        queryKey: ["symbol-hover", symbolName],
        queryFn: () => {
            if (!symbolName) {
                return null;
            }
            const query = `sym:\\b${symbolName}\\b repo:^${escapeStringRegexp(repoName)}$`;

            return search({
                query,
                matches: 1,
                contextLines: 0,
            }, domain).then((result) => {
                if (isServiceError(result)) {
                    return null;
                }

                if (result.files.length > 0) {
                    const file = result.files[0];
                    const chunk = file.chunks[0];
                    const content = base64Decode(chunk.content);
                    return content.trim();
                } else {
                    return null;
                }
            });
        },
        staleTime: Infinity,
    });

    const clearTimers = useCallback(() => {
        if (mouseOverTimerRef.current) {
            clearTimeout(mouseOverTimerRef.current);
        }

        if (mouseOutTimerRef.current) {
            clearTimeout(mouseOutTimerRef.current);
        }
    }, []);

    useEffect(() => {
        const view = editorRef.view;
        if (!view) {
            return;
        }

        const handleMouseOver = (event: MouseEvent) => {
            const target = (event.target as HTMLElement).closest('[data-underline-node="true"]') as HTMLElement;
            if (!target) {
                return;
            }
            clearTimers();
            setSymbolElement(target);

            mouseOverTimerRef.current = setTimeout(() => {
                setIsVisible(true);
            }, SYMBOL_HOVER_POPUP_MOUSE_OVER_TIMEOUT);
        };

        const handleMouseOut = () => {
            clearTimers();
            
            mouseOutTimerRef.current = setTimeout(() => {
                setIsVisible(false);
            }, SYMBOL_HOVER_POPUP_MOUSE_OUT_TIMEOUT);
        };

        view.dom.addEventListener("mouseover", handleMouseOver);
        view.dom.addEventListener("mouseout", handleMouseOut);

        return () => {
            view.dom.removeEventListener("mouseover", handleMouseOver);
            view.dom.removeEventListener("mouseout", handleMouseOut);
        };
    }, [editorRef, domain, clearTimers]);

    if (!isVisible && !isSticky) {
        return undefined;
    }

    if (!symbolElement || !symbolName) {
        return undefined;
    }

    return {
        element: symbolElement,
        symbolName,
        isSymbolDefInfoLoading: isSymbolDefinitionLoading,
        symbolDefInfo: data ? {
            lineContent: data,
        } : undefined,
    };
}
