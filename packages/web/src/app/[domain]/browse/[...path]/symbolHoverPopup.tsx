import { useEffect, useMemo, useRef, useState } from "react";
import { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { autoPlacement, computePosition, offset, shift, VirtualElement } from "@floating-ui/react";
import { search } from "@/app/api/(client)/client";
import { useDomain } from "@/hooks/useDomain";
import { base64Decode, isServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface SymbolHoverPopupProps {
    editorRef: ReactCodeMirrorRef;
}

const SYMBOL_HOVER_POPUP_TIMEOUT = 500;

export const SymbolHoverPopup: React.FC<SymbolHoverPopupProps> = ({ editorRef }) => {
    const ref = useRef<HTMLDivElement>(null);
    const element = useHoveredSymbolElement(editorRef);

    useEffect(() => {
        if (!element) {
            return;
        }

        const virtualElement: VirtualElement = {
            getBoundingClientRect: () => {
                return element.hoveredOverElement.getBoundingClientRect();
            }
        }

        if (ref.current) {
            computePosition(virtualElement, ref.current, {
                middleware: [
                    offset(5),
                    autoPlacement({
                        boundary: editorRef.view?.dom,
                        padding: 5,
                        allowedPlacements: ['top'],
                    }),
                    shift({
                        padding: 5
                    })
                ]
            }).then(({ x, y }) => {
                if (ref.current) {
                    ref.current.style.left = `${x}px`;
                    ref.current.style.top = `${y}px`;
                }
            })
        }
    }, [element, editorRef]);

    return element ? (
        <div
            ref={ref}
            className="absolute z-10 flex flex-col gap-2 bg-background border border-gray-300 dark:border-gray-700 rounded-md shadow-lg p-2"
        >
            <p className="text-sm font-mono">{element.content}</p>
        </div>
    ) : null;
};

const useHoveredSymbolElement = (editorRef: ReactCodeMirrorRef) => {
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
    const domain = useDomain();
    const [isVisible, setIsVisible] = useState(false);
    
    const [hoveredOverElement, setHoveredOverElement] = useState<HTMLElement | null>(null);
    const hoveredOverElementContent = useMemo(() => {
        return (hoveredOverElement && hoveredOverElement.textContent) ?? undefined;
    }, [hoveredOverElement]);

    const { data, isPending } = useQuery({
        queryKey: ["symbol-hover", hoveredOverElementContent],
        queryFn: () => {
            if (!hoveredOverElementContent) {
                return null;
            }
            const query = `sym:${hoveredOverElementContent} repo:^github\\.com/sourcebot\x2ddev/sourcebot$`;

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
                    return content;
                } else {
                    return null;
                }
            });
        },
        staleTime: Infinity,
    });

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
            setHoveredOverElement(target);

            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
            }

            hoverTimerRef.current = setTimeout(() => {
                setIsVisible(true);
            }, SYMBOL_HOVER_POPUP_TIMEOUT);
        };

        const handleMouseOut = () => {
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
            }
            setHoveredOverElement(null);
            setIsVisible(false);
        };

        view.dom.addEventListener("mouseover", handleMouseOver);
        view.dom.addEventListener("mouseout", handleMouseOut);

        return () => {
            view.dom.removeEventListener("mouseover", handleMouseOver);
            view.dom.removeEventListener("mouseout", handleMouseOut);
        };
    }, [editorRef, domain]);


    if (!isVisible || !hoveredOverElement) {
        return undefined;
    }

    return {
        hoveredOverElement,
        content: isPending ?
            "loading..." :
            data ?
                data :
                "no results found",
    };
}
