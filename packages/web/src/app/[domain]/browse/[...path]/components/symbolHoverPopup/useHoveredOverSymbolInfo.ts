import { search } from "@/app/api/(client)/client";
import { SearchResultRange } from "@/features/search/types";
import { useDomain } from "@/hooks/useDomain";
import { base64Decode, isServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import escapeStringRegexp from "escape-string-regexp";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";


interface UseHoveredOverSymbolInfoProps {
    editorRef: ReactCodeMirrorRef;
    isSticky: boolean;
    repoName: string;
}

export interface SymbolDefInfo {
    content: string;
    language: string;
    fileName: string;
    repoName: string;
    range: SearchResultRange;
}

interface HoveredOverSymbolInfo {
    element: HTMLElement;
    symbolName: string;
    isSymbolDefInfoLoading: boolean;
    symbolDefInfo?: SymbolDefInfo;
}

const SYMBOL_HOVER_POPUP_MOUSE_OVER_TIMEOUT = 500;
const SYMBOL_HOVER_POPUP_MOUSE_OUT_TIMEOUT = 100;

export const useHoveredOverSymbolInfo = ({
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

    // @todo: refactor this into a server action.
    const { data: symbolDefInfo, isPending: isSymbolDefinitionLoading } = useQuery({
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
            }, domain).then((result): SymbolDefInfo | null => {
                if (isServiceError(result) || !editorRef.state) {
                    return null;
                }

                if (result.files.length === 0) {
                    return null;
                }
                const file = result.files[0];

                if (file.chunks.length === 0) {
                    return null;
                }
                const chunk = file.chunks[0];

                if (chunk.matchRanges.length === 0) {
                    return null;
                }

                const matchRange = chunk.matchRanges[0];
                const content = base64Decode(chunk.content);

                return {
                    content: content,
                    language: file.language,
                    fileName: file.fileName.text,
                    repoName: repoName,
                    range: matchRange,
                };
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
        symbolDefInfo: symbolDefInfo ?? undefined,
    };
}
