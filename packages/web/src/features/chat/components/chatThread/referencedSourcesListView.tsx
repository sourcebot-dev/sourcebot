'use client';

import { useBrowseNavigation } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { PathHeader } from "@/app/[domain]/components/pathHeader";
import { fetchFileSource } from "@/app/api/(client)/client";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SymbolHoverPopup } from '@/ee/features/codeNav/components/symbolHoverPopup';
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { SymbolDefinition } from '@/ee/features/codeNav/components/symbolHoverPopup/useHoveredOverSymbolInfo';
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useDomain } from "@/hooks/useDomain";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { cn, isServiceError, unwrapServiceError } from "@/lib/utils";
import { Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { useQueries } from "@tanstack/react-query";
import CodeMirror, { ReactCodeMirrorRef, StateField } from '@uiw/react-codemirror';
import { ChevronDown, ChevronRight } from "lucide-react";
import { forwardRef, Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import scrollIntoView from 'scroll-into-view-if-needed';
import { FileReference, FileSource, Reference, Source } from "../../types";
import { createCodeFoldingExtension } from "./codeFoldingExtension";

interface ReferencedSourcesListViewProps {
    references: FileReference[];
    sources: Source[];
    hoveredReference?: Reference;
    onHoveredReferenceChanged: (reference?: Reference) => void;
    selectedReference?: Reference;
    onSelectedReferenceChanged: (reference?: Reference) => void;
    style: React.CSSProperties;
}

const resolveFileReference = (reference: FileReference, sources: FileSource[]): FileSource | undefined => {
    return sources.find(
        (source) => source.repo.endsWith(reference.repo) &&
        source.path.endsWith(reference.path)
    );
}

const getFileId = (fileSource: FileSource) => {
    return `file-source-${fileSource.repo}-${fileSource.path}`;
}

const lineDecoration = Decoration.line({
    attributes: { class: "cm-range-border-radius chat-lineHighlight" },
});

const selectedLineDecoration = Decoration.line({
    attributes: { class: "cm-range-border-radius cm-range-border-shadow chat-lineHighlight-selected" },
});

const hoverLineDecoration = Decoration.line({
    attributes: { class: "chat-lineHighlight-hover" },
});

export const ReferencedSourcesListView = ({
    references,
    sources,
    hoveredReference,
    selectedReference,
    style,
    onHoveredReferenceChanged,
    onSelectedReferenceChanged,
}: ReferencedSourcesListViewProps) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const editorRefsMap = useRef<Map<string, ReactCodeMirrorRef>>(new Map());
    const domain = useDomain();

    const setEditorRef = useCallback((fileKey: string, ref: ReactCodeMirrorRef | null) => {
        if (ref) {
            editorRefsMap.current.set(fileKey, ref);
        } else {
            editorRefsMap.current.delete(fileKey);
        }
    }, []);

    const referencedFileSources = useMemo((): FileSource[] => {
        const fileSources = sources.filter((source) => source.type === 'file');

        return references
            .filter((reference) => reference.type === 'file')
            .map((reference) => resolveFileReference(reference, fileSources))
            .filter((file) => file !== undefined)
            // de-duplicate files
            .filter((file, index, self) =>
                index === self.findIndex((t) =>
                    t?.path === file?.path
                    && t?.repo === file?.repo
                    && t?.revision === file?.revision
                )
            );
    }, [references, sources]);

    // Memoize the computation of references grouped by file source
    const referencesGroupedByFile = useMemo(() => {
        const groupedReferences = new Map<string, FileReference[]>();

        for (const fileSource of referencedFileSources) {
            const fileKey = getFileId(fileSource);
            const referencesInFile = references.filter((reference) => {
                if (reference.type !== 'file') {
                    return false;
                }
                return resolveFileReference(reference, [fileSource]) !== undefined;
            });
            groupedReferences.set(fileKey, referencesInFile);
        }

        return groupedReferences;
    }, [references, referencedFileSources]);

    const fileSourceQueries = useQueries({
        queries: referencedFileSources.map((file) => ({
            queryKey: ['fileSource', file.path, file.repo, file.revision, domain],
            queryFn: () => unwrapServiceError(fetchFileSource({
                fileName: file.path,
                repository: file.repo,
                branch: file.revision,
            }, domain)),
            staleTime: Infinity,
        })),
    });


    useEffect(() => {
        if (!selectedReference || selectedReference.type !== 'file') {
            return;
        }

        const fileSource = resolveFileReference(selectedReference, referencedFileSources);
        if (!fileSource) {
            return;
        }

        const fileId = getFileId(fileSource);

        const fileSourceElement = document.getElementById(fileId);

        if (!fileSourceElement) {
            return;
        }

        const editorRef = editorRefsMap.current.get(fileId);
        const scrollAreaViewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;

        // If we have a range, we can scroll to the starting line number.
        if (
            selectedReference.range &&
            editorRef &&
            editorRef.view &&
            scrollAreaViewport &&
            selectedReference.range.startLine <= editorRef.view.state.doc.lines
        ) {
            const view = editorRef.view;
            const lineNumber = selectedReference.range.startLine;

            // Get the line's position within the CodeMirror document
            const pos = view.state.doc.line(lineNumber).from;
            const blockInfo = view.lineBlockAt(pos);
            const lineTopInCodeMirror = blockInfo.top;

            // Get the bounds of both elements
            const viewportRect = scrollAreaViewport.getBoundingClientRect();
            const codeMirrorRect = view.dom.getBoundingClientRect();

            // Calculate the line's position relative to the ScrollArea content
            const lineTopRelativeToScrollArea = lineTopInCodeMirror + (codeMirrorRect.top - viewportRect.top) + scrollAreaViewport.scrollTop;

            // Get the height of the visible ScrollArea
            const scrollAreaHeight = scrollAreaViewport.clientHeight;

            // Calculate the target scroll position to center the line
            const targetScrollTop = lineTopRelativeToScrollArea - (scrollAreaHeight / 3);

            // Scroll to the calculated position
            scrollAreaViewport.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth',
            });
        }

        // Otherwise, fallback to scrolling to the top of the file.
        else {
            scrollIntoView(fileSourceElement, {
                scrollMode: 'if-needed',
                block: 'start',
                behavior: 'smooth',
            });
        }
    }, [referencedFileSources, selectedReference]);

    if (referencedFileSources.length === 0) {
        return (
            <div className="p-4 text-center text-muted-foreground text-sm">
                No file references found
            </div>
        );
    }

    return (
        <ScrollArea
            ref={scrollAreaRef}
            style={style}
        >
            <div className="space-y-4 pr-2">
                {fileSourceQueries.map((query, index) => {
                    const fileSource = referencedFileSources[index];
                    const fileName = fileSource.path.split('/').pop() ?? fileSource.path;

                    if (query.isLoading) {
                        return (
                            <div key={`${fileSource.repo}/${fileSource.path}`} className="space-y-2">
                                <div className="flex items-center gap-2 p-2">
                                    <VscodeFileIcon fileName={fileName} className="w-4 h-4" />
                                    <span className="text-sm font-medium">{fileName}</span>
                                </div>
                                <Skeleton className="h-48 w-full" />
                            </div>
                        );
                    }

                    if (query.isError || isServiceError(query.data)) {
                        return (
                            <div key={`${fileSource.repo}/${fileSource.path}`} className="space-y-2">
                                <div className="flex items-center gap-2 p-2">
                                    <VscodeFileIcon fileName={fileName} className="w-4 h-4" />
                                    <span className="text-sm font-medium">{fileName}</span>
                                </div>
                                <div className="p-4 text-sm text-destructive bg-destructive/10 rounded border">
                                    Failed to load file: {isServiceError(query.data) ? query.data.message : 'Unknown error'}
                                </div>
                            </div>
                        );
                    }

                    const fileData = query.data!;

                    const fileId = getFileId(fileSource);
                    const referencesInFile = referencesGroupedByFile.get(fileId) || [];

                    return (
                        <CodeMirrorCodeBlockWithRef
                            key={fileId}
                            id={fileId}
                            code={fileData.source}
                            language={fileData.language}
                            revision={fileSource.revision}
                            repoName={fileSource.repo}
                            repoCodeHostType={fileData.repositoryCodeHostType}
                            repositoryDisplayName={fileData.repositoryDisplayName}
                            fileName={fileData.path}
                            references={referencesInFile}
                            ref={(ref) => setEditorRef(fileId, ref)}
                            onSelectedReferenceChanged={onSelectedReferenceChanged}
                            onHoveredReferenceChanged={onHoveredReferenceChanged}
                            selectedReference={selectedReference}
                            hoveredReference={hoveredReference}
                            // When collapsing a file when you are deep in a scroll, it's a better
                            // experience to have the scroll automatically restored to the top of the file
                            // s.t., header is still sticky to the top of the scroll area.
                            onCollapse={() => {
                                const fileSourceStart = document.getElementById(`${fileId}-start`);
                                if (!fileSourceStart) {
                                    return;
                                }

                                scrollIntoView(fileSourceStart, {
                                    scrollMode: 'if-needed',
                                    block: 'start',
                                    behavior: 'instant',
                                });
                            }}
                        />
                    );
                })}
            </div>
        </ScrollArea>

    );
}

interface CodeMirrorCodeBlockProps {
    id: string;
    code: string;
    language: string;
    revision: string;
    repoName: string;
    repoCodeHostType: string;
    repositoryDisplayName?: string;
    fileName: string;
    references: FileReference[];
    selectedReference?: FileReference;
    hoveredReference?: FileReference;
    onSelectedReferenceChanged: (reference?: FileReference) => void;
    onHoveredReferenceChanged: (reference?: FileReference) => void;
    onCollapse: () => void;
}

const CodeMirrorCodeBlock = ({
    id,
    code,
    language,
    revision,
    repoName,
    repoCodeHostType,
    repositoryDisplayName,
    fileName,
    references,
    selectedReference,
    hoveredReference,
    onSelectedReferenceChanged,
    onHoveredReferenceChanged,
    onCollapse,
}: CodeMirrorCodeBlockProps, forwardedRef: Ref<ReactCodeMirrorRef>) => {
    const theme = useCodeMirrorTheme();
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);
    const [isExpanded, _setIsExpanded] = useState(true);

    const setIsExpanded = useCallback((isExpanded: boolean) => {
        _setIsExpanded(isExpanded);
        if (!isExpanded) {
            onCollapse();
        }
    }, [onCollapse]);

    useImperativeHandle(
        forwardedRef,
        () => editorRef as ReactCodeMirrorRef
    );
    const keymapExtension = useKeymapExtension(editorRef?.view);
    const hasCodeNavEntitlement = useHasEntitlement("code-nav");

    const languageExtension = useCodeMirrorLanguageExtension(language, editorRef?.view);
    const { navigateToPath } = useBrowseNavigation();

    const getReferenceAtPos = useCallback((x: number, y: number, view: EditorView): FileReference | undefined => {
        const pos = view.posAtCoords({ x, y });
        if (pos === null) return undefined;

        // Check if position is within the main editor content area
        const rect = view.contentDOM.getBoundingClientRect();
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            return undefined;
        }

        const line = view.state.doc.lineAt(pos);
        const lineNumber = line.number;

        // Check if this line is part of any highlighted range
        const matchingRanges = references.filter(({ range }) =>
            range && lineNumber >= range.startLine && lineNumber <= range.endLine
        );

        // Sort by the length of the range.
        // Shorter ranges are more specific, so we want to prioritize them.
        matchingRanges.sort((a, b) => {
            const aLength = (a.range!.endLine) - (a.range!.startLine);
            const bLength = (b.range!.endLine) - (b.range!.startLine);
            return aLength - bLength;
        });

        if (matchingRanges.length > 0) {
            return matchingRanges[0];
        }

        return undefined;
    }, [references]);

    const codeFoldingExtension = useMemo(() => {
        return createCodeFoldingExtension(references, 3);
    }, [references]);

    const extensions = useMemo(() => {
        return [
            languageExtension,
            EditorView.lineWrapping,
            keymapExtension,
            ...(hasCodeNavEntitlement ? [
                symbolHoverTargetsExtension,
            ] : []),
            codeFoldingExtension,
            StateField.define<DecorationSet>({
                create(state) {
                    const decorations: Range<Decoration>[] = [];

                    for (const { range, id } of references) {
                        if (!range) {
                            continue;
                        }

                        const isHovered = id === hoveredReference?.id;
                        const isSelected = id === selectedReference?.id;

                        for (let line = range.startLine; line <= range.endLine; line++) {
                            // Skip lines that are outside the document bounds.
                            if (line > state.doc.lines) {
                                continue;
                            }

                            if (isSelected) {
                                decorations.push(selectedLineDecoration.range(state.doc.line(line).from));
                            } else {
                                decorations.push(lineDecoration.range(state.doc.line(line).from));
                                if (isHovered) {
                                    decorations.push(hoverLineDecoration.range(state.doc.line(line).from));
                                }
                            }

                        }
                    }

                    decorations.sort((a, b) => a.from - b.from);
                    return Decoration.set(decorations);
                },
                update(deco, tr) {
                    return deco.map(tr.changes);
                },
                provide: (field) => EditorView.decorations.from(field),
            }),
            EditorView.domEventHandlers({
                click: (event, view) => {
                    const reference = getReferenceAtPos(event.clientX, event.clientY, view);

                    if (reference) {
                        onSelectedReferenceChanged(reference.id === selectedReference?.id ? undefined : reference);
                        return true; // prevent default handling
                    }
                    return false;
                },
                mouseover: (event, view) => {
                    const reference = getReferenceAtPos(event.clientX, event.clientY, view);
                    if (!reference) {
                        return false;
                    }

                    if (reference.id === selectedReference?.id || reference.id === hoveredReference?.id) {
                        return false;
                    }

                    onHoveredReferenceChanged(reference);
                    return true;
                },
                mouseout: (event, view) => {
                    const reference = getReferenceAtPos(event.clientX, event.clientY, view);
                    if (reference) {
                        return false;
                    }

                    onHoveredReferenceChanged(undefined);
                    return true;
                }
            })
        ];
    }, [
        languageExtension,
        keymapExtension,
        hasCodeNavEntitlement,
        references,
        hoveredReference?.id,
        selectedReference?.id,
        getReferenceAtPos,
        onSelectedReferenceChanged,
        onHoveredReferenceChanged,
        codeFoldingExtension,
    ]);

    const onGotoDefinition = useCallback((symbolName: string, symbolDefinitions: SymbolDefinition[]) => {
        if (symbolDefinitions.length === 0) {
            return;
        }

        if (symbolDefinitions.length === 1) {
            const symbolDefinition = symbolDefinitions[0];
            const { fileName, repoName } = symbolDefinition;

            navigateToPath({
                repoName,
                revisionName: revision,
                path: fileName,
                pathType: 'blob',
                highlightRange: symbolDefinition.range,
            })
        } else {
            navigateToPath({
                repoName,
                revisionName: revision,
                path: fileName,
                pathType: 'blob',
                setBrowseState: {
                    selectedSymbolInfo: {
                        symbolName,
                        repoName,
                        revisionName: revision,
                        language: language,
                    },
                    activeExploreMenuTab: "definitions",
                    isBottomPanelCollapsed: false,
                }
            });

        }
    }, [navigateToPath, revision, repoName, fileName, language]);

    const onFindReferences = useCallback((symbolName: string) => {
        navigateToPath({
            repoName,
            revisionName: revision,
            path: fileName,
            pathType: 'blob',
            setBrowseState: {
                selectedSymbolInfo: {
                    symbolName,
                    repoName,
                    revisionName: revision,
                    language: language,
                },
                activeExploreMenuTab: "references",
                isBottomPanelCollapsed: false,
            }
        })

    }, [fileName, language, navigateToPath, repoName, revision]);

    const ExpandCollapseIcon = useMemo(() => {
        return isExpanded ? ChevronDown : ChevronRight;
    }, [isExpanded]);

    return (
        <div className="relative" id={id}>
            {/* Sentinel element to scroll to when collapsing a file */}
            <div id={`${id}-start`} />
            {/* Sticky header outside the bordered container */}
            <div className={cn("sticky top-0 z-10 flex flex-row items-center bg-accent py-1 px-3 gap-1.5 border-l border-r border-t rounded-t-md", {
                'rounded-b-md border-b': !isExpanded,
            })}>
                <ExpandCollapseIcon className={`h-3 w-3 cursor-pointer mt-0.5`} onClick={() => setIsExpanded(!isExpanded)} />
                <PathHeader
                    path={fileName}
                    repo={{
                        name: repoName,
                        codeHostType: repoCodeHostType,
                        displayName: repositoryDisplayName,
                    }}
                    branchDisplayName={revision === 'HEAD' ? undefined : revision}
                    repoNameClassName="font-normal text-muted-foreground text-sm"
                />
            </div>

            {/* Code container */}
            {/* @note: don't conditionally render here since we want to maintain state */}
            <div className="border-l border-r border-b rounded-b-md overflow-hidden" style={{
                height: isExpanded ? 'auto' : '0px',
                visibility: isExpanded ? 'visible' : 'hidden',
            }}>
                <CodeMirror
                    ref={setEditorRef}
                    value={code}
                    extensions={extensions}
                    readOnly={true}
                    theme={theme}
                    basicSetup={{
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                        foldGutter: false,
                        foldKeymap: false,
                    }}
                >
                    {editorRef && hasCodeNavEntitlement && (
                        <SymbolHoverPopup
                            editorRef={editorRef}
                            revisionName={revision}
                            language={language}
                            onFindReferences={onFindReferences}
                            onGotoDefinition={onGotoDefinition}
                        />
                    )}
                </CodeMirror>
            </div>
        </div>
    )
}

export const CodeMirrorCodeBlockWithRef = forwardRef(CodeMirrorCodeBlock) as (
    props: CodeMirrorCodeBlockProps & { ref?: Ref<ReactCodeMirrorRef> },
) => ReturnType<typeof CodeMirrorCodeBlock>;
