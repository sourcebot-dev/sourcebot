'use client';

import { getBrowsePath, useBrowseNavigation, BrowseHighlightRange } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { SymbolHoverPopup } from '@/ee/features/codeNav/components/symbolHoverPopup';
import { SymbolDefinition } from '@/ee/features/codeNav/components/symbolHoverPopup/useHoveredOverSymbolInfo';
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { useCodeMirrorLanguageExtension } from "@/hooks/useCodeMirrorLanguageExtension";
import { useCodeMirrorTheme } from "@/hooks/useCodeMirrorTheme";
import { useDomain } from "@/hooks/useDomain";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { EditorView } from '@codemirror/view';
import { useQueries } from "@tanstack/react-query";
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useCallback, useMemo, useRef, useState } from "react";
import { Source, FileReference, Reference, FileSource } from "../../types";
import Link from "next/link";
import { fetchFileSource } from "@/app/api/(client)/client";
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { rangeHighlightingExtension } from "@/app/[domain]/browse/[...path]/components/rangeHighlightingExtension";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ReferencedSourcesListViewProps {
    references: FileReference[];
    sources: Source[];
    highlightedReference?: Reference;
    style: React.CSSProperties;
}

const resolveFileReference = (reference: FileReference, sources: FileSource[]): FileSource | undefined => {
    return sources.find((source) => source.path.endsWith(reference.fileName));
}

export const ReferencedSourcesListView = ({
    references,
    sources,
    highlightedReference,
    style,
}: ReferencedSourcesListViewProps) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const fileSources = useMemo(() => {
        return sources.filter((source) => source.type === 'file');
    }, [sources]);

    const referencedFileSources = useMemo((): FileSource[] => {
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
    }, [references, fileSources]);

    const domain = useDomain();
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

                    let highlightRange: BrowseHighlightRange | undefined;
                    if (
                        highlightedReference &&
                        highlightedReference.type === 'file' &&
                        highlightedReference.range &&
                        resolveFileReference(highlightedReference, [fileSource]) !== undefined
                    ) {
                        highlightRange = {
                            start: { lineNumber: highlightedReference.range.startLine },
                            end: { lineNumber: highlightedReference.range.endLine },
                        }
                    }

                    return (
                        <CodeMirrorCodeBlock
                            code={fileData.source}
                            language={fileData.language}
                            revision={fileSource.revision}
                            repoName={fileSource.repo}
                            fileName={fileData.path}
                            highlightRange={highlightRange}
                        />
                    );
                })}
            </div>
        </ScrollArea>

    );
}

interface CodeMirrorCodeBlockProps {
    code: string;
    language: string;
    revision: string;
    repoName: string;
    fileName: string;
    // @todo: we should move this into a more generic place.
    highlightRange?: BrowseHighlightRange;
}

const CodeMirrorCodeBlock = ({ code, language, revision, repoName, fileName, highlightRange }: CodeMirrorCodeBlockProps) => {
    const domain = useDomain();
    const theme = useCodeMirrorTheme();
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);
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
            ...(highlightRange ? [
                rangeHighlightingExtension(highlightRange),
            ] : []),
        ];
    }, [languageExtension, keymapExtension, highlightRange, hasCodeNavEntitlement]);

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
        <div className="relative">
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
