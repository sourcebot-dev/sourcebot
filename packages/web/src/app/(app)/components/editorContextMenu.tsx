'use client';

import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { createPathWithQueryParams } from "@/lib/utils";
import { autoPlacement, computePosition, offset, shift, VirtualElement } from "@floating-ui/react";
import { Link2Icon } from "@radix-ui/react-icons";
import { EditorView, SelectionRange } from "@uiw/react-codemirror";
import { useCallback, useEffect, useRef } from "react";
import { HIGHLIGHT_RANGE_QUERY_PARAM } from "../browse/hooks/utils";

interface ContextMenuProps {
    view: EditorView;
    selection: SelectionRange;
    repoName: string;
    path: string;
    revisionName: string;
}

export const EditorContextMenu = ({
    view,
    selection,
    repoName,
    path,
    revisionName,
}: ContextMenuProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();
    const { createChatFromSource } = useCreateNewChatThread();
    useEffect(() => {
        if (selection.empty) {
            ref.current?.classList.add('hidden');
        } else {
            ref.current?.classList.remove('hidden');
        }
    }, [selection.empty]);


    useEffect(() => {
        if (selection.empty) {
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
                    }),
                    shift({
                        padding: 5
                    })
                ],
            }).then(({ x, y }) => {
                if (ref.current) {
                    ref.current.style.left = `${x}px`;
                    ref.current.style.top = `${y}px`;
                }
            });
        }

    }, [selection, view]);

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

        const basePath = `${window.location.origin}/browse`;
        const url = createPathWithQueryParams(`${basePath}/${repoName}@${revisionName}/-/blob/${path}`,
            [HIGHLIGHT_RANGE_QUERY_PARAM, `${from?.line}:${from?.column},${to?.line}:${to?.column}`],
        );

        navigator.clipboard.writeText(url);
        toast({
            description: "✅ Copied link to selection",
        });

        captureEvent('wa_share_link_created', {});

        // Reset the selection
        view.dispatch(
            {
                selection: {
                    anchor: selection.to,
                    head: selection.to,
                }     
            }
        )
    }, [selection.from, selection.to, repoName, revisionName, path, toast, captureEvent, view]);

    const onAskSourcebot = useCallback(() => {
        if (selection.empty) {
            return;
        }

        const startLine = view.state.doc.lineAt(selection.from).number;
        const endLine = view.state.doc.lineAt(selection.to - 1).number;

        void createChatFromSource({
            type: 'file',
            repo: repoName,
            path,
            name: path.split('/').pop() ?? path,
            revision: revisionName,
            range: { startLine, endLine },
        });
    }, [createChatFromSource, path, repoName, revisionName, selection, view]);

    return (
<div
  ref={ref}
  className="absolute z-10 flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-xl"
>
  <Button
    variant="secondary"
    size="sm"
    onClick={onCopyLinkToSelection}
    className="h-8 px-3 hover:bg-black/50"
  >
    <Link2Icon className="mr-2 h-4 w-4" />
    Share selection
  </Button>

  <Button
    variant="secondary"
    size="sm"
    onClick={onAskSourcebot}
    className="h-8 px-3 hover:bg-black/50"
  >
    Ask SourceBot
  </Button>
</div>
    )
}
