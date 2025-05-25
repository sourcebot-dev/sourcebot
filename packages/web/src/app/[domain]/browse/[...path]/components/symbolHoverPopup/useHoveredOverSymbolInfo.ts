import { findSearchBasedSymbolDefinitions } from "@/features/codeNav/actions";
import { SourceRange } from "@/features/search/types";
import { useDomain } from "@/hooks/useDomain";
import { unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";


interface UseHoveredOverSymbolInfoProps {
    editorRef: ReactCodeMirrorRef;
    isSticky: boolean;
    repoName: string;
    revisionName: string;
}

interface HoveredOverSymbolInfo {
    element: HTMLElement;
    symbolName: string;
    isSymbolDefinitionsLoading: boolean;
    symbolDefinitions?: {
        lineContent: string;
        language: string;
        fileName: string;
        repoName: string;
        range: SourceRange;
    }[];
}

const SYMBOL_HOVER_POPUP_MOUSE_OVER_TIMEOUT = 500;
const SYMBOL_HOVER_POPUP_MOUSE_OUT_TIMEOUT = 100;

export const useHoveredOverSymbolInfo = ({
    editorRef,
    isSticky,
    repoName,
    revisionName,
}: UseHoveredOverSymbolInfoProps): HoveredOverSymbolInfo | undefined => {
    const mouseOverTimerRef = useRef<NodeJS.Timeout | null>(null);
    const mouseOutTimerRef = useRef<NodeJS.Timeout | null>(null);

    const domain = useDomain();
    const [isVisible, setIsVisible] = useState(false);

    const [symbolElement, setSymbolElement] = useState<HTMLElement | null>(null);
    const symbolName = useMemo(() => {
        return (symbolElement && symbolElement.textContent) ?? undefined;
    }, [symbolElement]);

    const { data: symbolDefinitions, isLoading: isSymbolDefinitionsLoading } = useQuery({
        queryKey: ["definitions", symbolName, repoName, revisionName, domain],
        queryFn: () => unwrapServiceError(
            findSearchBasedSymbolDefinitions(symbolName!, repoName, domain, revisionName)
        ),
        select: ((data) => {
            return data.files.flatMap((file) => {
                return file.matches.map((match) => {
                    return {
                        lineContent: match.lineContent,
                        language: file.language,
                        fileName: file.fileName,
                        repoName: file.repository,
                        range: match.range,
                    }
                })
            })

        }),
        enabled: !!symbolName,
        staleTime: Infinity,
    })

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
        isSymbolDefinitionsLoading: isSymbolDefinitionsLoading,
        symbolDefinitions,
    };
}
