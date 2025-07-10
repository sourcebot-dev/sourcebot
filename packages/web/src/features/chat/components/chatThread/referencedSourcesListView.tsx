'use client';

import { getBrowsePath, useBrowseNavigation } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
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
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { useQueries } from "@tanstack/react-query";
import CodeMirror, { ReactCodeMirrorRef, StateField } from '@uiw/react-codemirror';
import Link from "next/link";
import { forwardRef, Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import scrollIntoView from 'scroll-into-view-if-needed';
import { FileReference, FileSource, Reference, Source } from "../../types";

interface ReferencedSourcesListViewProps {
    references: FileReference[];
    sources: Source[];
    highlightedReference?: Reference;
    selectedReference?: Reference;
    onSelectedReferenceChanged: (reference: Reference) => void;
    style: React.CSSProperties;
}

const resolveFileReference = (reference: FileReference, sources: FileSource[]): FileSource | undefined => {
    return sources.find((source) => source.path.endsWith(reference.fileName));
}

const getFileId = (fileSource: FileSource) => {
    return `file-source-${fileSource.repo}-${fileSource.path}`;
}

const lineDecoration = Decoration.line({
    attributes: { class: "chat-lineHighlight" },
});

const selectedLineDecoration = Decoration.line({
    attributes: { class: "chat-lineHighlight-selected" },
});

const hoverLineDecoration = Decoration.line({
    attributes: { class: "chat-lineHighlight-hover" },
});

export const ReferencedSourcesListView = ({
    references,
    sources,
    highlightedReference,
    selectedReference,
    style,
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
            selectedReference.range
            && editorRef
            && editorRef.view
            && scrollAreaViewport
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
            <div className="space-y-6">
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

                    // Resolve a list of references that are in this file.
                    const referencesInFile =
                        references.filter((reference) => {
                            if (reference.type !== 'file') {
                                return false;
                            }
                            return resolveFileReference(reference, [fileSource]) !== undefined;
                        })
                        .map((reference) => {
                            return {
                                reference,
                                isSelected:
                                    reference.id === selectedReference?.id,
                                isHovered:
                                    reference.id === highlightedReference?.id
                            }
                        });

                    const key = getFileId(fileSource);

                    return (
                        <CodeMirrorCodeBlockWithRef
                            key={key}
                            id={key}
                            code={fileData.source}
                            language={fileData.language}
                            revision={fileSource.revision}
                            repoName={fileSource.repo}
                            fileName={fileData.path}
                            references={referencesInFile}
                            ref={(ref) => setEditorRef(key, ref)}
                            onReferenceClicked={(reference) => {
                                onSelectedReferenceChanged(reference);
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
    fileName: string;
    references: {
        reference: FileReference;
        isSelected: boolean;
        isHovered: boolean;
    }[];
    onReferenceClicked: (reference: FileReference) => void;
}

const CodeMirrorCodeBlock = ({
    id,
    code,
    language,
    revision,
    repoName,
    fileName,
    references,
    onReferenceClicked,
}: CodeMirrorCodeBlockProps, forwardedRef: Ref<ReactCodeMirrorRef>) => {
    const domain = useDomain();
    const theme = useCodeMirrorTheme();
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);

    useImperativeHandle(
        forwardedRef,
        () => editorRef as ReactCodeMirrorRef
    );
    const keymapExtension = useKeymapExtension(editorRef?.view);
    const hasCodeNavEntitlement = useHasEntitlement("code-nav");

    const languageExtension = useCodeMirrorLanguageExtension(language, editorRef?.view);
    const { navigateToPath } = useBrowseNavigation();


    const extensions = useMemo(() => {
        return [
            languageExtension,
            EditorView.lineWrapping,
            keymapExtension,
            ...(hasCodeNavEntitlement ? [
                symbolHoverTargetsExtension,
            ] : []),
            StateField.define<DecorationSet>({
                create(state) {
                    const decorations: Range<Decoration>[] = [];

                    for (const { reference: { range }, isSelected, isHovered } of references) {
                        if (!range) {
                            continue;
                        }

                        for (let line = range.startLine; line <= range.endLine; line++) {
                            const decoration = isSelected ? selectedLineDecoration : isHovered ? hoverLineDecoration : lineDecoration;
                            decorations.push(decoration.range(state.doc.line(line).from));
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
                    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                    if (pos === null) return false;
                    
                    const line = view.state.doc.lineAt(pos);
                    const lineNumber = line.number;
                    
                    // Check if this line is part of any highlighted range
                    const matchingRanges = references.filter(({ reference: { range } }) =>
                        range && lineNumber >= range.startLine && lineNumber <= range.endLine
                    );

                    // Sort by the length of the range.
                    // Shorter ranges are more specific, so we want to prioritize them.
                    matchingRanges.sort((a, b) => {
                        const aLength = (a.reference.range!.endLine) - (a.reference.range!.startLine);
                        const bLength = (b.reference.range!.endLine) - (b.reference.range!.startLine);
                        return aLength - bLength;
                    });

                    if (matchingRanges.length > 0) {
                        onReferenceClicked(matchingRanges[0].reference);
                        return true; // Prevent default handling
                    }
                    
                    return false;
                }
            })
        ];
    }, [languageExtension, keymapExtension, hasCodeNavEntitlement, references, onReferenceClicked]);

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

    return (
        <div className="relative" id={id}>
            {/* Sticky header outside the bordered container */}
            <div className="sticky top-0 z-10 flex flex-row items-center bg-accent py-1 px-3 gap-1.5 border-l border-r border-t rounded-t-md">
                <VscodeFileIcon fileName={fileName} className="h-4 w-4" />
                <Link
                    className="flex-1 block truncate-start text-foreground text-sm font-mono cursor-pointer hover:underline"
                    href={getBrowsePath({
                        repoName,
                        revisionName: revision,
                        path: fileName,
                        pathType: 'blob',
                        domain,
                    })}
                >
                    {fileName}
                </Link>
            </div>

            {/* Code container */}
            <div className="border-l border-r border-b rounded-b-md overflow-hidden">
                <CodeMirror
                    ref={setEditorRef}
                    value={code}
                    extensions={extensions}
                    readOnly={true}
                    theme={theme}
                    basicSetup={{
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
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
