import { findSearchBasedSymbolDefinitions } from "@/app/api/(client)/client";
import { SourceRange } from "@/features/search";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useDomain } from "@/hooks/useDomain";
import { measure, unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SYMBOL_HOVER_TARGET_DATA_ATTRIBUTE } from "./symbolHoverTargetsExtension";

interface UseHoveredOverSymbolInfoProps {
    editorRef: ReactCodeMirrorRef;
    isSticky: boolean;
    revisionName: string;
    language: string;
    repoName: string;
}

export type SymbolDefinition = {
    lineContent: string;
    language: string;
    fileName: string;
    repoName: string;
    revisionName: string;
    range: SourceRange;
}

interface HoveredOverSymbolInfo {
    element: HTMLElement;
    symbolName: string;
    range: SourceRange;
    isSymbolDefinitionsLoading: boolean;
    symbolDefinitions?: SymbolDefinition[];
}

const SYMBOL_HOVER_POPUP_MOUSE_OVER_TIMEOUT_MS = 500;
const SYMBOL_HOVER_POPUP_MOUSE_OUT_TIMEOUT_MS = 100;

export const useHoveredOverSymbolInfo = ({
    editorRef,
    isSticky,
    revisionName,
    language,
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

    const captureEvent = useCaptureEvent();

    const { data: symbolDefinitions, isLoading: isSymbolDefinitionsLoading } = useQuery({
        queryKey: ["definitions", symbolName, revisionName, language, domain, repoName],
        queryFn: async () => {
            const response = await measure(() => unwrapServiceError(
                findSearchBasedSymbolDefinitions({
                    symbolName: symbolName!,
                    language,
                    revisionName,
                    repoName,
                })
            ), 'findSearchBasedSymbolDefinitions', false);

            captureEvent('wa_symbol_hover_popup_definitions_loaded', {
                durationMs: response.durationMs,
            });

            return response.data;
        },
        select: ((data) => {
            return data.files.flatMap((file) => {
                return file.matches.map((match) => {
                    return {
                        lineContent: match.lineContent,
                        language: file.language,
                        fileName: file.fileName,
                        repoName: file.repository,
                        revisionName: revisionName,
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
            const target = (event.target as HTMLElement).closest(`[${SYMBOL_HOVER_TARGET_DATA_ATTRIBUTE}="true"]`) as HTMLElement;
            if (!target) {
                return;
            }
            clearTimers();
            setSymbolElement(target);

            mouseOverTimerRef.current = setTimeout(() => {
                setIsVisible(true);
            }, SYMBOL_HOVER_POPUP_MOUSE_OVER_TIMEOUT_MS);
        };

        const handleMouseOut = () => {
            clearTimers();

            mouseOutTimerRef.current = setTimeout(() => {
                setIsVisible(false);
            }, SYMBOL_HOVER_POPUP_MOUSE_OUT_TIMEOUT_MS);
        };

        view.dom.addEventListener("mouseover", handleMouseOver);
        view.dom.addEventListener("mouseout", handleMouseOut);

        return () => {
            view.dom.removeEventListener("mouseover", handleMouseOver);
            view.dom.removeEventListener("mouseout", handleMouseOut);
        };
    }, [editorRef, domain, clearTimers]);

    // Extract the highlight range of the symbolElement from the editor view.
    const highlightRange = useMemo((): SourceRange | undefined => {
        if (!symbolElement || !editorRef.view) {
            return undefined;
        }

        const view = editorRef.view;
        const rect = symbolElement.getBoundingClientRect();

        // Get the start position (left edge, middle vertically)
        const startPos = view.posAtCoords({
            x: rect.left,
            y: rect.top + rect.height / 2,
        });

        // Get the end position (right edge, middle vertically)
        const endPos = view.posAtCoords({
            x: rect.right,
            y: rect.top + rect.height / 2,
        });

        if (startPos === null || endPos === null) {
            return undefined;
        }

        // Convert CodeMirror positions to SourceRange format
        const startLine = view.state.doc.lineAt(startPos);
        const endLine = view.state.doc.lineAt(endPos);

        const startColumn = startPos - startLine.from + 1; // 1-based column
        const endColumn = endPos - endLine.from + 1; // 1-based column

        return {
            start: {
                byteOffset: startPos, // 0-based byte offset
                lineNumber: startLine.number, // 1-based line number
                column: startColumn, // 1-based column
            },
            end: {
                byteOffset: endPos, // 0-based byte offset
                lineNumber: endLine.number, // 1-based line number
                column: endColumn, // 1-based column
            },
        };
    }, [symbolElement, editorRef.view]);

    if (!isVisible && !isSticky) {
        return undefined;
    }

    if (!symbolElement || !symbolName || !highlightRange) {
        return undefined;
    }

    return {
        element: symbolElement,
        symbolName,
        range: highlightRange,
        isSymbolDefinitionsLoading: isSymbolDefinitionsLoading,
        symbolDefinitions,
    };
}
