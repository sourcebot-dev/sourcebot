'use client';

import { useHasEntitlement } from '@/features/entitlements/useHasEntitlement';
import { useCodeMirrorLanguageExtension } from '@/hooks/useCodeMirrorLanguageExtension';
import { useCodeMirrorTheme } from '@/hooks/useCodeMirrorTheme';
import { useDomain } from '@/hooks/useDomain';
import { useFindLanguageDescription } from '@/hooks/useFindLanguageDescription';
import { useKeymapExtension } from '@/hooks/useKeymapExtension';
import { lineOffsetExtension } from '@/lib/extensions/lineOffsetExtension';
import { cn } from '@/lib/utils';
import { EditorView } from '@codemirror/view';
import { DoubleArrowDownIcon, DoubleArrowUpIcon } from '@radix-ui/react-icons';
import { useIsClient } from "@uidotdev/usehooks";
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { getBrowsePath, useBrowseNavigation } from '@/app/[domain]/browse/hooks/useBrowseNavigation';
import { LightweightCodeHighlighter } from '@/app/[domain]/components/lightweightCodeHighlighter';
import { CodeBlockMetadata, codeBlockMetadataSchema } from '@/features/chat/constants';
import { VscodeFileIcon } from '@/app/components/vscodeFileIcon';
import { symbolHoverTargetsExtension } from '@/ee/features/codeNav/components/symbolHoverPopup/symbolHoverTargetsExtension';
import { SymbolDefinition } from '@/ee/features/codeNav/components/symbolHoverPopup/useHoveredOverSymbolInfo';
import { SymbolHoverPopup } from '@/ee/features/codeNav/components/symbolHoverPopup';


interface CodeBlockComponentProps {
    code: string;
    isStreaming: boolean;
    language?: string;
    metadataPayload?: string;
}

const MAX_LINES_TO_DISPLAY = 14;

export const CodeBlock = ({
    code,
    isStreaming,
    language = "text",
    metadataPayload,
}: CodeBlockComponentProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const domain = useDomain();
    const isClient = useIsClient();

    const metadata = useMemo(() => {
        if (!metadataPayload) {
            return undefined;
        }

        try {
            const metadata = JSON.parse(metadataPayload);
            return codeBlockMetadataSchema.parse(metadata);
        }
        catch {
            return undefined;
        }
    }, [metadataPayload]);

    const lineCount = useMemo(() => {
        return code.split('\n').length;
    }, [code]);

    const isExpandButtonVisible = useMemo(() => {
        return lineCount > MAX_LINES_TO_DISPLAY;
    }, [lineCount]);

    return (
        <div className="flex flex-col rounded-md border overflow-hidden not-prose my-4">
            {metadata && (
                <div className="flex flex-row items-center bg-accent py-1 px-3 gap-1.5">
                    <VscodeFileIcon fileName={metadata.filePath} className="h-4 w-4" />
                    <Link
                        className="flex-1 block truncate-start text-foreground text-sm font-mono cursor-pointer hover:underline"
                        href={getBrowsePath({
                            repoName: metadata.repository,
                            revisionName: metadata.revision,
                            path: metadata.filePath,
                            pathType: 'blob',
                            domain,
                            highlightRange: {
                                start: {
                                    lineNumber: metadata.startLine,
                                },
                                end: {
                                    lineNumber: metadata.endLine,
                                }
                            }
                        })}
                    >
                        {metadata.filePath}
                    </Link>
                </div>
            )}
            <div
                className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    {
                        "max-h-[350px]": !isExpanded && isExpandButtonVisible, // Roughly 14 lines
                        "max-h-none": isExpanded || !isExpandButtonVisible
                    }
                )}
            >
                {(isStreaming || !isClient) ? (
                    <LightweightCodeHighlighter
                        language={language}
                        lineNumbers={true}
                        renderWhitespace={true}
                        lineNumbersOffset={metadata?.startLine ?? 1}
                    >
                        {code}
                    </LightweightCodeHighlighter>
                ) : (
                    <CodeMirrorCodeBlock
                        code={code}
                        language={language}
                        metadata={metadata}
                    />
                )}
            </div>
            {isExpandButtonVisible && (
                <div
                    tabIndex={0}
                    className="flex flex-row items-center justify-center w-full bg-accent py-1 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => setIsExpanded(!isExpanded)}
                    onKeyDown={(e) => {
                        if (e.key !== "Enter") {
                            return;
                        }
                        setIsExpanded(!isExpanded);
                    }}
                >
                    {isExpanded ? <DoubleArrowUpIcon className="w-3 h-3" /> : <DoubleArrowDownIcon className="w-3 h-3" />}
                    <span className="text-sm ml-1">{isExpanded ? 'Show less' : 'Show more'}</span>
                </div>
            )}
        </div>
    );
};

interface CodeMirrorCodeBlockProps {
    code: string;
    language: string;
    metadata?: CodeBlockMetadata;
}

const CodeMirrorCodeBlock = ({ code, language: _language, metadata }: CodeMirrorCodeBlockProps) => {
    const theme = useCodeMirrorTheme();
    const [editorRef, setEditorRef] = useState<ReactCodeMirrorRef | null>(null);
    const keymapExtension = useKeymapExtension(editorRef?.view);
    const hasCodeNavEntitlement = useHasEntitlement("code-nav");

    // @note: we use `languageDescription.name` since `_language` is not a linguist language name.
    const languageDescription = useFindLanguageDescription({ languageName: _language });
    const language = useMemo(() => {
        return languageDescription?.name ?? 'Text';
    }, [languageDescription]);

    const languageExtension = useCodeMirrorLanguageExtension(language, editorRef?.view);
    const { navigateToPath } = useBrowseNavigation();


    const extensions = useMemo(() => {
        return [
            languageExtension,
            EditorView.lineWrapping,
            keymapExtension,
            ...(metadata ? [
                lineOffsetExtension(metadata.startLine - 1),

                ...(hasCodeNavEntitlement ? [
                    symbolHoverTargetsExtension,
                ] : []),
            ] : []),
        ];
    }, [languageExtension, keymapExtension, metadata, hasCodeNavEntitlement]);

    const onGotoDefinition = useCallback((symbolName: string, symbolDefinitions: SymbolDefinition[]) => {
        if (!metadata || symbolDefinitions.length === 0) {
            return;
        }

        if (symbolDefinitions.length === 0) {
            return;
        }

        if (symbolDefinitions.length === 1) {
            const symbolDefinition = symbolDefinitions[0];
            const { fileName, repoName } = symbolDefinition;
            const { revision } = metadata;

            navigateToPath({
                repoName,
                revisionName: revision,
                path: fileName,
                pathType: 'blob',
                highlightRange: symbolDefinition.range,
            })
        } else {
            const { repository, revision, filePath } = metadata;

            navigateToPath({
                repoName: repository,
                revisionName: revision,
                path: filePath,
                pathType: 'blob',
                setBrowseState: {
                    selectedSymbolInfo: {
                        symbolName,
                        repoName: repository,
                        revisionName: revision,
                        language: language,
                    },
                    activeExploreMenuTab: "definitions",
                    isBottomPanelCollapsed: false,
                }
            });

        }
    }, [metadata, navigateToPath, language]);

    const onFindReferences = useCallback((symbolName: string) => {
        if (!metadata) {
            return;
        }

        const { repository, revision, filePath } = metadata;
        navigateToPath({
            repoName: repository,
            revisionName: revision,
            path: filePath,
            pathType: 'blob',
            setBrowseState: {
                selectedSymbolInfo: {
                    symbolName,
                    repoName: repository,
                    revisionName: revision,
                    language: language,
                },
                activeExploreMenuTab: "references",
                isBottomPanelCollapsed: false,
            }
        })

    }, [language, metadata, navigateToPath]);


    return (
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
            {editorRef && hasCodeNavEntitlement && metadata && (
                <SymbolHoverPopup
                    editorRef={editorRef}
                    revisionName={metadata.revision}
                    language={language}
                    onFindReferences={onFindReferences}
                    onGotoDefinition={onGotoDefinition}
                />
            )}
        </CodeMirror>
    )
}
