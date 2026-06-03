'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { SymbolHoverPopup } from "@/ee/features/codeNav/components/symbolHoverPopup";
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { search } from "@codemirror/search";
import CodeMirror, { EditorSelection, EditorView, ReactCodeMirrorRef, SelectionRange, ViewUpdate } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContextMenu } from "@/app/(app)/components/editorContextMenu";
import { BrowseHighlightRange, getBrowsePath, HIGHLIGHT_RANGE_QUERY_PARAM } from "@/app/(app)/browse/hooks/utils";
import { rangeHighlightingExtension } from "./rangeHighlightingExtension";
import { blameGutterExtension } from "./blameGutterExtension";
import type { FileBlameResponse } from "@/features/git";

interface PureCodePreviewPanelProps {
    path: string;
    repoName: string;
    revisionName: string;
    source: string;
    language: string;
    blame?: FileBlameResponse;
}

export const PureCodePreviewPanel = ({
    source,
    language,
    path,
    repoName,
    revisionName,
    blame,
}: PureCodePreviewPanelProps) => {
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const languageExtension = useCodeMirrorLanguageExtension(language, editorRef?.view);
    const [currentSelection, setCurrentSelection] = useState<SelectionRange>();
    const keymapExtension = useKeymapExtension(editorRef?.view);
    const hasCodeNavEntitlement = useHasEntitlement("code-nav");
    const router = useRouter();

    const handleBlameCommitClick = useCallback((commit: { hash: string; path: string }) => {
        router.push(getBrowsePath({
            repoName,
            revisionName,
            path: commit.path,
            pathType: 'blob',
            previewRef: commit.hash,
            diff: true,
        }));
    }, [router, repoName, revisionName]);

    const handleBlameReblameClick = useCallback((previous: { hash: string; path: string }) => {
        router.push(getBrowsePath({
            repoName,
            revisionName: previous.hash,
            path: previous.path,
            pathType: 'blob',
            blame: true,
        }));
    }, [router, repoName]);

    const highlightRangeQuery = useNonEmptyQueryParam(HIGHLIGHT_RANGE_QUERY_PARAM);
    const highlightRange = useMemo((): BrowseHighlightRange | undefined => {
        if (!highlightRangeQuery) {
            return;
        }

        // Highlight ranges can be formatted in two ways:
        // 1. start_line,end_line                            (no column specified)
        // 2. start_line:start_column,end_line:end_column    (column specified)
        const rangeRegex = /^(\d+:\d+,\d+:\d+|\d+,\d+)$/;
        if (!rangeRegex.test(highlightRangeQuery)) {
            return;
        }

        const [start, end] = highlightRangeQuery.split(',').map((range) => {
            if (range.includes(':')) {
                return range.split(':').map((val) => parseInt(val, 10));
            }
            // For line-only format, use column 1 for start and last column for end
            const line = parseInt(range, 10);
            return [line];
        });

        if (start.length === 1 || end.length === 1) {
            return {
                start: {
                    lineNumber: start[0],
                },
                end: {
                    lineNumber: end[0],
                }
            }
        } else {
            return {
                start: {
                    lineNumber: start[0],
                    column: start[1],
                },
                end: {
                    lineNumber: end[0],
                    column: end[1],
                }
            }
        }
    }, [highlightRangeQuery]);

    const extensions = useMemo(() => {
        return [
            languageExtension,
            EditorView.lineWrapping,
            keymapExtension,
            search({
                top: true,
            }),
            EditorView.updateListener.of((update: ViewUpdate) => {
                if (update.selectionSet) {
                    setCurrentSelection(update.state.selection.main);
                }
            }),
            highlightRange ? rangeHighlightingExtension(highlightRange) : [],
            hasCodeNavEntitlement ? symbolHoverTargetsExtension : [],
            blame ? blameGutterExtension(
                blame,
                handleBlameCommitClick,
                handleBlameReblameClick
            ) : [],
        ];
    }, [
        keymapExtension,
        languageExtension,
        highlightRange,
        hasCodeNavEntitlement,
        blame,
        handleBlameCommitClick,
        handleBlameReblameClick,
    ]);

    // Scroll the highlighted range into view.
    useEffect(() => {
        if (!highlightRange || !editorRef || !editorRef.state || !editorRef.view) {
            return;
        }

        const doc = editorRef.state.doc;
        const { start, end } = highlightRange;

        if (start.lineNumber > doc.lines || end.lineNumber > doc.lines) {
            console.warn(`Highlight range is out of bounds: start.lineNumber=${start.lineNumber}, end.lineNumber=${end.lineNumber}, doc.lines=${doc.lines}`);
            return;
        }

        const from = doc.line(start.lineNumber).from;
        const to = doc.line(end.lineNumber).to;
        const selection = EditorSelection.range(from, to);

        // When the selection is in view, we don't want to perform any scrolling
        // as it could be jarring for the user. If it is not in view, scroll to the
        // center of the viewport.
        const viewport = editorRef.view.viewport;
        const isInView = from >= viewport.from && to <= viewport.to;
        const scrollStrategy = isInView ? "nearest" : "center";

        editorRef.view?.dispatch({
            effects: [
                EditorView.scrollIntoView(selection, { y: scrollStrategy }),
            ]
        });
    }, [editorRef, highlightRange]);

    // Scroll restoration. The editor grows to its content height, so the actual
    // scroll container is the ScrollArea's viewport (not CodeMirror's own
    // scroller). We persist the scroll position per file and restore it on mount.
    const scrollPositionStorageKey = useMemo(
        () => `browse-scroll-pos:${repoName}@${revisionName}:${path}`,
        [repoName, revisionName, path],
    );

    // Persist the scroll position as the user scrolls, throttled to one write
    // per animation frame.
    useEffect(() => {
        const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
            '[data-radix-scroll-area-viewport]'
        );
        if (!viewport) {
            return;
        }

        let frame = 0;
        const handleScroll = () => {
            if (frame) {
                return;
            }
            frame = requestAnimationFrame(() => {
                frame = 0;
                sessionStorage.setItem(scrollPositionStorageKey, JSON.stringify({
                    top: viewport.scrollTop,
                    left: viewport.scrollLeft,
                }));
            });
        };

        viewport.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            viewport.removeEventListener('scroll', handleScroll);
            if (frame) {
                cancelAnimationFrame(frame);
            }
        };
    }, [scrollPositionStorageKey]);

    // Restore the saved scroll position once the editor is ready. We skip this
    // when a highlight range is present so the highlight scroll-into-view above
    // takes precedence. The ref guards against re-restoring (e.g. after the user
    // has already scrolled) while still re-running when the file changes.
    const restoredScrollKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (highlightRange) {
            return;
        }
        if (restoredScrollKeyRef.current === scrollPositionStorageKey) {
            return;
        }
        if (!editorRef?.view) {
            return;
        }

        const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
            '[data-radix-scroll-area-viewport]'
        );
        if (!viewport) {
            return;
        }

        restoredScrollKeyRef.current = scrollPositionStorageKey;

        const saved = sessionStorage.getItem(scrollPositionStorageKey);
        if (!saved) {
            return;
        }

        try {
            const { top, left } = JSON.parse(saved);
            // Defer to the next frame so the editor's content has been laid out
            // and the viewport has its full scroll height.
            requestAnimationFrame(() => {
                viewport.scrollTo({ top, left });
            });
        } catch {
            // Ignore malformed entries.
        }
    }, [editorRef, highlightRange, scrollPositionStorageKey]);

    const theme = useCodeMirrorTheme();

    return (
        <ScrollArea ref={scrollAreaRef} className="h-full overflow-auto flex-1">
            <CodeMirror
                className="relative"
                ref={setEditorRef}
                value={source}
                extensions={extensions}
                readOnly={true}
                theme={theme}
                basicSetup={
                    blame ? {
                        foldGutter: false,
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                    } : true
                }
            >
                {editorRef && editorRef.view && currentSelection && (
                    <EditorContextMenu
                        view={editorRef.view}
                        selection={currentSelection}
                        repoName={repoName}
                        path={path}
                        revisionName={revisionName}
                    />
                )}
                {editorRef && hasCodeNavEntitlement && (
                    <SymbolHoverPopup
                        source="preview"
                        editorRef={editorRef}
                        revisionName={revisionName}
                        language={language}
                        fileName={path}
                        repoName={repoName}
                    />
                )}
            </CodeMirror>

        </ScrollArea>
    )
}

