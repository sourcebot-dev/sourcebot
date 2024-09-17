'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useExtensionWithDependency } from "@/hooks/useExtensionWithDependency";
import { useSyntaxHighlightingExtension } from "@/hooks/useSyntaxHighlightingExtension";
import { useThemeNormalized } from "@/hooks/useThemeNormalized";
import { lineOffsetExtension } from "@/lib/extensions/lineOffsetExtension";
import { SearchResultFile, SearchResultRange } from "@/lib/schemas";
import { getRepoCodeHostInfo } from "@/lib/utils";
import { DoubleArrowDownIcon, DoubleArrowUpIcon, FileIcon } from "@radix-ui/react-icons";
import { Scrollbar } from "@radix-ui/react-scroll-area";
import CodeMirror, { Decoration, DecorationSet, EditorState, EditorView, ReactCodeMirrorRef, StateField, Transaction } from '@uiw/react-codemirror';
import clsx from "clsx";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";

const MAX_MATCHES_TO_PREVIEW = 3;

interface SearchResultsPanelProps {
    fileMatches: SearchResultFile[];
    onOpenFileMatch: (fileMatch: SearchResultFile) => void;
    onMatchIndexChanged: (matchIndex: number) => void;
}

export const SearchResultsPanel = ({
    fileMatches,
    onOpenFileMatch,
    onMatchIndexChanged,
}: SearchResultsPanelProps) => {
    return (
        <ScrollArea className="h-full">
            {fileMatches.map((fileMatch, index) => (
                <FilePreview
                    key={index}
                    file={fileMatch}
                    onOpenFile={() => {
                        onOpenFileMatch(fileMatch);
                    }}
                    onMatchIndexChanged={(matchIndex) => {
                        onMatchIndexChanged(matchIndex);
                    }}
                />
            ))}
            <Scrollbar orientation="vertical" />
        </ScrollArea>
    )
}

interface FilePreviewProps {
    file: SearchResultFile;
    onOpenFile: () => void;
    onMatchIndexChanged: (matchIndex: number) => void;
}

const FilePreview = ({
    file,
    onOpenFile,
    onMatchIndexChanged,
}: FilePreviewProps) => {

    const [showAll, setShowAll] = useState(false);
    const matchCount = useMemo(() => {
        return file.ChunkMatches.length;
    }, [file]);

    const matches = useMemo(() => {
        const sortedMatches = file.ChunkMatches.sort((a, b) => {
            return a.ContentStart.LineNumber - b.ContentStart.LineNumber;
        });

        if (!showAll) {
            return sortedMatches.slice(0, MAX_MATCHES_TO_PREVIEW);
        }

        return sortedMatches;
    }, [file, showAll]);

    const fileNameRange = useMemo(() => {
        for (const match of matches) {
            if (match.FileName && match.Ranges.length > 0) {
                const range = match.Ranges[0];
                return {
                    from: range.Start.Column - 1,
                    to: range.End.Column - 1,
                }
            }
        }

        return null;
    }, [matches]);

    const { repoIcon, repoName, repoLink } = useMemo(() => {
        const info = getRepoCodeHostInfo(file.Repository);
        if (info) {
            return {
                repoName: info.repoName,
                repoLink: info.repoLink,
                repoIcon: <Image
                    src={info.icon}
                    alt={info.costHostName}
                    className="w-4 h-4 dark:invert"
                />
            }
        }

        return {
            repoName: file.Repository,
            repoLink: undefined,
            repoIcon: <FileIcon className="w-4 h-4" />
        }
    }, [file]);

    const isMoreContentButtonVisible = useMemo(() => {
        return matchCount > MAX_MATCHES_TO_PREVIEW;
    }, [matchCount]);

    return (
        <div>
            <div
                className="sticky top-0 bg-cyan-200 dark:bg-cyan-900 primary-foreground px-2 py-0.5 flex flex-row items-center justify-between border cursor-pointer z-10"
                onClick={() => {
                    onOpenFile();
                }}
            >
                <div className="flex flex-row gap-2 items-center">
                    {repoIcon}
                    <span
                        className={clsx("font-medium", {
                            "cursor-pointer hover:underline": repoLink,
                        })}
                        onClick={() => {
                            if (repoLink) {
                                window.open(repoLink, "_blank");
                            }
                        }}
                    >
                        {repoName}
                    </span>
                    <span>·</span>
                    {!fileNameRange ? (
                        <span>{file.FileName}</span> 
                    ) : (
                        <span>
                            {file.FileName.slice(0, fileNameRange.from)}
                            <span className="bg-yellow-200 dark:bg-blue-700">
                                {file.FileName.slice(fileNameRange.from, fileNameRange.to)}
                            </span>
                            {file.FileName.slice(fileNameRange.to)}
                        </span>
                    )}
                </div>
            </div>
            {matches.map((match, index) => {
                const content = atob(match.Content);

                // If it's just the title, don't show a code preview
                if (match.FileName) {
                    return null;
                }

                const lineOffset = match.ContentStart.LineNumber - 1;

                return (
                    <div
                        key={index}
                        className="cursor-pointer"
                        onClick={() => {
                            const matchIndex = matches.slice(0, index).reduce((acc, match) => {
                                return acc + match.Ranges.length;
                            }, 0);
                            onOpenFile();
                            onMatchIndexChanged(matchIndex);
                        }}
                    >
                        <CodePreview
                            content={content}
                            language={file.Language}
                            ranges={match.Ranges}
                            lineOffset={lineOffset}
                        />
                        {(index !== matches.length - 1 || isMoreContentButtonVisible) && (
                            <Separator className="dark:bg-gray-400" />
                        )}
                    </div>
                );
            })}
            {isMoreContentButtonVisible && (
                <div className="px-4 bg-accent">
                    <p
                        onClick={() => setShowAll(!showAll)}
                        className="text-blue-500 cursor-pointer text-sm flex flex-row items-center gap-2"
                    >
                        {showAll ? <DoubleArrowUpIcon className="w-3 h-3" /> : <DoubleArrowDownIcon className="w-3 h-3" />}
                        {showAll ? `Show fewer matches` : `Show ${matchCount - MAX_MATCHES_TO_PREVIEW} more matches`}
                    </p>
                </div>
            )}
        </div>
    );
}

const markDecoration = Decoration.mark({
    class: "cm-searchMatch"
});

const cmTheme = EditorView.baseTheme({
    "&light .cm-searchMatch": {
        border: "1px #6b7280ff",
    },
    "&dark .cm-searchMatch": {
        border: "1px #d1d5dbff",
    },
});

const CodePreview = ({
    content,
    language,
    ranges,
    lineOffset,
}: {
    content: string,
    language: string,
    ranges: SearchResultRange[],
    lineOffset: number,
}) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const { theme } = useThemeNormalized();

    const syntaxHighlighting = useSyntaxHighlightingExtension(language, editorRef.current?.view);

    const rangeHighlighting = useExtensionWithDependency(editorRef.current?.view ?? null, () => {
        return [
            StateField.define<DecorationSet>({
                create(editorState: EditorState) {
                    const document = editorState.doc;

                    const decorations = ranges
                        .sort((a, b) => {
                            return a.Start.ByteOffset - b.Start.ByteOffset;
                        })
                        .map(({ Start, End }) => {
                            const from = document.line(Start.LineNumber - lineOffset).from + Start.Column - 1;
                            const to = document.line(End.LineNumber - lineOffset).from + End.Column - 1;
                            return markDecoration.range(from, to);
                        });

                    return Decoration.set(decorations);
                },
                update(highlights: DecorationSet, _transaction: Transaction) {
                    return highlights;
                },
                provide: (field) => EditorView.decorations.from(field),
            }),
            cmTheme
        ];
    }, [ranges]);

    const extensions = useMemo(() => {
        return [
            syntaxHighlighting,
            lineOffsetExtension(lineOffset),
            rangeHighlighting,
        ];
    }, [syntaxHighlighting, lineOffset, rangeHighlighting]);

    return (
        <CodeMirror
            ref={editorRef}
            readOnly={true}
            editable={false}
            value={content}
            theme={theme === "dark" ? "dark" : "light"}
            basicSetup={{
                lineNumbers: true,
                syntaxHighlighting: true,

                // Disable all this other stuff...
                ... {
                    foldGutter: false,
                    highlightActiveLineGutter: false,
                    highlightSpecialChars: false,
                    history: false,
                    drawSelection: false,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    indentOnInput: false,
                    bracketMatching: false,
                    closeBrackets: false,
                    autocompletion: false,
                    rectangularSelection: false,
                    crosshairCursor: false,
                    highlightActiveLine: false,
                    highlightSelectionMatches: false,
                    closeBracketsKeymap: false,
                    defaultKeymap: false,
                    searchKeymap: false,
                    historyKeymap: false,
                    foldKeymap: false,
                    completionKeymap: false,
                    lintKeymap: false,
                }
            }}
            extensions={extensions}
        />
    )
}
