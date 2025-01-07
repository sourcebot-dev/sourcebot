'use client';

import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { createPathWithQueryParams } from "@/lib/utils";
import { autoPlacement, computePosition, offset, VirtualElement } from "@floating-ui/react";
import { Link2Icon } from "@radix-ui/react-icons";
import { EditorView, SelectionRange } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ContextMenuProps {
    view: EditorView;
    selection: SelectionRange;
    repoName: string;
    path: string;
}

export const ContextMenu = ({
    view,
    selection,
    repoName,
    path,
}: ContextMenuProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const { toast } = useToast();

    const { show, hide } = useMemo(() => {
        return {
            show: () => ref.current?.classList.remove('hidden'),
            hide: () => ref.current?.classList.add('hidden'),
        }
    }, []);

    useEffect(() => {
        const onMouseDown = () => {
            setIsMouseDown(true);
        }

        const onMouseUp = () => {
            setIsMouseDown(false);
        }

        view.dom.addEventListener('mousedown', onMouseDown);
        view.dom.addEventListener('mouseup', onMouseUp);
        return () => {
            view.dom.removeEventListener('mousedown', onMouseDown);
            view.dom.removeEventListener('mouseup', onMouseUp);
        }
    }, [view.dom]);

    useEffect(() => {
        if (selection.empty || isMouseDown) {
            hide();
            return;
        }

        const { from, to } = selection;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        if (!start || !end) {
            return;
        }

        const selectionElement: VirtualElement = {
            getBoundingClientRect: () => {

                const { top, left } = start;
                const { bottom, right } = end;

                return {
                    x: left,
                    y: top,
                    top,
                    bottom,
                    left,
                    right,
                    width: right - left,
                    height: bottom - top,
                }
            }
        }

        if (ref.current) {
            computePosition(selectionElement, ref.current, {
                middleware: [
                    offset(5),
                    autoPlacement({
                        boundary: view.dom,
                        padding: 5,
                        allowedPlacements: ['bottom'],
                    })
                ],
            }).then(({ x, y }) => {
                if (ref.current) {
                    ref.current.style.left = `${x}px`;
                    ref.current.style.top = `${y}px`;
                    show();
                }
            });
        }

    }, [hide, isMouseDown, selection, show, view]);

    const onCopyLinkToSelection = useCallback(() => {
        const toLineAndColumn = (pos: number) => {
            const lineInfo = view.state.doc.lineAt(pos);
            return {
                line: lineInfo.number,
                column: pos - lineInfo.from + 1,
            }
        }

        const from = toLineAndColumn(selection.from);
        const to = toLineAndColumn(selection.to);

        const url = createPathWithQueryParams(`${window.location.origin}/browse/${repoName}/-/blob/${path}`,
            ['highlightRange', `${from?.line}:${from?.column},${to?.line}:${to?.column}`],
        );

        navigator.clipboard.writeText(url);
        toast({
            description: "✅ Copied link to selection",
        });
        hide();
    }, [hide, path, repoName, selection.from, selection.to, toast, view.state.doc]);

    return (
        <div
            ref={ref}
            className="fixed z-10 flex flex-col gap-2 bg-background border border-gray-300 dark:border-gray-700 rounded-md shadow-lg p-2"
        >
            <Button
                variant="ghost"
                size="sm"
                onClick={onCopyLinkToSelection}
            >
                <Link2Icon className="h-4 w-4 mr-1" />
                Share selection
            </Button>
        </div>
    )
}