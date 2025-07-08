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
import { ChatContext, FileReference } from "../../types";
import Link from "next/link";
import { fetchFileSource } from "@/app/api/(client)/client";
import { symbolHoverTargetsExtension } from "@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension";
import { rangeHighlightingExtension } from "@/app/[domain]/browse/[...path]/components/rangeHighlightingExtension";

interface FileReferencesListProps {
    fileReferences: FileReference[];
    chatContext: ChatContext;
    highlightedFileRange?: {
        fileName: string;
        startLine: number;
        endLine: number;
    };
}

export const FileReferencesList = ({ fileReferences, chatContext, highlightedFileRange}: FileReferencesListProps) => {
    const codeBlockRefs = useRef<Map<string, HTMLElement>>(new Map());

    const filesToFetch = useMemo(() => {
        return fileReferences
            .map(({ fileName }) => {
                const file = chatContext.files.find((file) => file.path.endsWith(fileName));
                if (file) {
                    return file;
                }
            })
            .filter((file) => file !== undefined)
            .filter((file, index, self) =>
                index === self.findIndex((t) =>
                    t?.path === file?.path
                    && t?.repository === file?.repository
                    && t?.revision === file?.revision
                )
            );
    }, [fileReferences, chatContext]);

    const domain = useDomain();
    const queries = useQueries({
        queries: filesToFetch.map((file) => ({
            queryKey: ['fileSource', file.path, file.repository, file.revision, domain],
            queryFn: () => unwrapServiceError(fetchFileSource({
                fileName: file.path,
                repository: file.repository,
                branch: file.revision,
            }, domain)),
            staleTime: Infinity,
        })),
    });

    if (filesToFetch.length === 0) {
        return (
            <div className="p-4 text-center text-muted-foreground text-sm">
                No file references found
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {queries.map((query, index) => {
                const file = filesToFetch[index];
                const fileName = file.path.split('/').pop() ?? file.path;

                if (query.isLoading) {
                    return (
                        <div key={`${file.repository}/${file.path}`} className="space-y-2">
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
                        <div key={`${file.repository}/${file.path}`} className="space-y-2">
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

                return (
                    <div
                        key={`${file.repository}/${file.path}`}
                        id={`file-reference-${fileName}`}
                        ref={(el) => {
                            if (el) {
                                codeBlockRefs.current.set(fileName, el);
                            } else {
                                codeBlockRefs.current.delete(fileName);
                            }
                        }}
                    >
                        <CodeMirrorCodeBlock
                            code={fileData.source}
                            language={fileData.language}
                            revision={file.revision}
                            repoName={file.repository}
                            fileName={fileData.path}
                            highlightRange={highlightedFileRange && highlightedFileRange.fileName === fileName ? {
                                start: { lineNumber: highlightedFileRange.startLine },
                                end: { lineNumber: highlightedFileRange.endLine },
                            } : undefined}
                        />
                    </div>
                );
            })}
        </div>
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
