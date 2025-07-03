'use client';

import { search } from "@/app/api/(client)/client";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomEditor, MentionElement, RenderElementPropsFor } from "@/features/chat/types";
import { insertMention, toString, word } from "@/features/chat/utils";
import { useDomain } from "@/hooks/useDomain";
import { cn, IS_MAC, unwrapServiceError } from "@/lib/utils";
import { computePosition, flip, offset, shift, VirtualElement } from "@floating-ui/react";
import { StopIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Loader2, StopCircleIcon } from "lucide-react";
import { Fragment, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHotkeys } from "react-hotkeys-hook";
import { Descendant, Editor, Range } from "slate";
import { Editable, ReactEditor, RenderElementProps, RenderLeafProps, useFocused, useSelected, useSlate, useSlateSelection } from "slate-react";

type SuggestionMode = "file" | "none";

interface ChatBoxProps {
    onSubmit: (children: Descendant[], editor: CustomEditor) => void;
    onStop?: () => void;
    selectedRepos: string[];
    preferredSuggestionsBoxPlacement?: "top-start" | "bottom-start";
    className?: string;
    isRedirecting?: boolean;
    isGenerating?: boolean;
}

export const ChatBox = ({
    onSubmit: _onSubmit,
    onStop,
    selectedRepos,
    preferredSuggestionsBoxPlacement = "bottom-start",
    className,
    isRedirecting,
    isGenerating,
}: ChatBoxProps) => {
    const suggestionsBoxRef = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    const domain = useDomain();
    const editor = useSlate();
    const selection = useSlateSelection();

    // Hotkey to focus the chat box.
    useHotkeys("/", (e) => {
        e.preventDefault();
        ReactEditor.focus(editor);
    });

    // Auto-focus chat box when the component mounts.
    useEffect(() => {
        ReactEditor.focus(editor);
    }, [editor]);

    const { suggestionQuery, range, suggestionMode } = useMemo<{
        suggestionQuery: string;
        range: Range | null;
        suggestionMode: SuggestionMode;
    }>(() => {
        if (!selection || !Range.isCollapsed(selection)) {
            return {
                suggestionMode: "none",
                suggestionQuery: '',
                range: null,
            };
        }

        const range = word(editor, selection, {
            terminator: [' '],
            directions: 'both',
        });

        if (!range) {
            return {
                suggestionMode: "none",
                suggestionQuery: '',
                range: null,
            };
        }

        const text = Editor.string(editor, range);

        const match = text.match(/^@([\w.-]*)$/);
        if (!match) {
            return {
                suggestionMode: "none",
                suggestionQuery: '',
                range: null,
            };
        }

        const suggestionQuery = match[1];

        return {
            suggestionMode: "file",
            range,
            suggestionQuery,
        }
    }, [editor, selection]);

    const { data: fileSuggestions, isPending: isPendingFileSuggestions, isError: isErrorFileSuggestions } = useQuery({
        queryKey: ["fileSuggestions", suggestionQuery, domain, selectedRepos],
        queryFn: () => {
            let query = `file:${suggestionQuery}`;
            if (selectedRepos.length > 0) {
                query += ` reposet:${selectedRepos.join(',')}`;
            }

            return unwrapServiceError(search({
                query,
                matches: 10,
                contextLines: 1,
            }, domain))
        },
        select: (data) => {
            return data.files.map((file) => {
                const path = file.fileName.text;
                const repo = file.repository;
                const name = path.split('/').pop() ?? '';
                const language = file.language;
                return {
                    path,
                    repo,
                    name,
                    language,
                }
            });
        },
        enabled: suggestionMode === "file",
    });

    const renderElement = useCallback((props: RenderElementProps) => {
        switch (props.element.type) {
            case 'mention':
                return <MentionComponent {...props as RenderElementPropsFor<MentionElement>} />
            default:
                return <DefaultElement {...props} />
        }
    }, []);

    const renderLeaf = useCallback((props: RenderLeafProps) => {
        return <Leaf {...props} />
    }, []);

    const isSubmitEnabled = useMemo(() => {
        return (
            toString(editor.children).trim().length > 0 &&
            !isRedirecting &&
            !isGenerating
        )
    }, [editor.children, isRedirecting, isGenerating]);

    const onSubmit = useCallback(() => {
        if (!isSubmitEnabled) {
            return;
        }

        _onSubmit(editor.children, editor);
    }, [_onSubmit, editor, isSubmitEnabled]);

    const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (suggestionMode === "none") {
            switch (event.key) {
                case 'Enter': {
                    if (event.shiftKey) {
                        break;
                    }

                    event.preventDefault();
                    onSubmit();
                    break;
                }
            }
        }
        else if (
            suggestionMode === "file" &&
            fileSuggestions &&
            fileSuggestions.length > 0
        ) {
            switch (event.key) {
                case 'ArrowDown': {
                    event.preventDefault();
                    const prevIndex = index >= fileSuggestions.length - 1 ? 0 : index + 1
                    setIndex(prevIndex)
                    break;
                }
                case 'ArrowUp': {
                    event.preventDefault();
                    const nextIndex = index <= 0 ? fileSuggestions.length - 1 : index - 1
                    setIndex(nextIndex)
                    break;
                }
                case 'Tab':
                case 'Enter': {
                    event.preventDefault();
                    const suggestion = fileSuggestions[index];

                    // @todo: make revision configurable.
                    insertMention(editor, {
                        type: 'file',
                        revision: 'HEAD',
                        ...suggestion,
                    }, range);
                    break;
                }
                case 'Escape': {
                    event.preventDefault();
                    break;
                }
            }
        }
    }, [suggestionMode, fileSuggestions, editor, onSubmit, index, range]);

    useEffect(() => {
        if (!range || !suggestionsBoxRef.current) {
            return;
        }

        const virtualElement: VirtualElement = {
            getBoundingClientRect: () => {
                if (!range) {
                    return new DOMRect();
                }

                return ReactEditor.toDOMRange(editor, range).getBoundingClientRect();
            }
        }

        computePosition(virtualElement, suggestionsBoxRef.current, {
            placement: preferredSuggestionsBoxPlacement,
            middleware: [
                offset(2),
                flip({
                    mainAxis: true,
                    crossAxis: false,
                    fallbackPlacements: ['top-start', 'bottom-start'],
                    padding: 20,
                }),
                shift({
                    padding: 5,
                })
            ]
        }).then(({ x, y }) => {
            if (suggestionsBoxRef.current) {
                suggestionsBoxRef.current.style.left = `${x}px`;
                suggestionsBoxRef.current.style.top = `${y}px`;
            }
        })
    }, [editor, index, range, fileSuggestions, preferredSuggestionsBoxPlacement]);

    return (
        <div
            className={cn("flex flex-col justify-between gap-0.5 w-full px-3 py-2", className)}
        >
            <Editable
                className="w-full focus-visible:outline-none focus-visible:ring-0 bg-background text-base disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                placeholder="Ask Sourcebot..."
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                onKeyDown={onKeyDown}
            />
            <div className="ml-auto z-10">
                {isRedirecting ? (
                    <Button
                        variant="default"
                        disabled={true}
                        size="icon"
                        className="w-6 h-6"
                    >
                        <Loader2 className="w-4 h-4 animate-spin" />
                    </Button>
                ) :
                isGenerating ? (
                    <Button
                        variant="default"
                        size="sm"
                        className="h-8"
                        onClick={onStop}
                    >
                        <StopCircleIcon className="w-4 h-4" />
                        Stop
                    </Button>
                ) : (
                    <Button
                        variant={isSubmitEnabled ? "default" : "outline"}
                        size="sm"
                        className="w-6 h-6"
                        onClick={onSubmit}
                        disabled={!isSubmitEnabled}
                    >
                        <ArrowUp className="w-4 h-4" />
                    </Button>
                )}
            </div>
            {suggestionMode === "file" && createPortal(
                <div
                    ref={suggestionsBoxRef}
                    className="absolute z-10 top-0 left-0 bg-background border rounded-md p-1 w-[500px] overflow-hidden text-ellipsis"
                    data-cy="mentions-portal"
                >
                    {isPendingFileSuggestions ? (
                        <div className="animate-pulse flex flex-col gap-2 px-1 py-0.5 w-full">
                            {
                                Array.from({ length: 10 }).map((_, index) => (
                                    <Skeleton key={index} className="h-4 w-full" />
                                ))
                            }
                        </div>
                    ) :
                        (isErrorFileSuggestions || fileSuggestions.length === 0) ? (
                            <div className="flex flex-col gap-2 px-1 py-0.5 w-full">
                                <p className="text-sm text-muted-foreground">
                                    No results found
                                </p>
                            </div>
                        ) :
                            (
                                <div className="flex flex-col w-full">
                                    {fileSuggestions.map((file, i) => (
                                        <div
                                            key={`${file.repo}-${file.path}`}
                                            className={cn("flex flex-row gap-2 w-full cursor-pointer rounded-md px-1 py-0.5 hover:bg-accent", {
                                                "bg-accent": i === index,
                                            })}
                                            onClick={() => {
                                                // @todo: make revision configurable.
                                                insertMention(editor, {
                                                    type: 'file',
                                                    revision: 'HEAD',
                                                    ...file,
                                                }, range);
                                                ReactEditor.focus(editor);
                                            }}
                                        >
                                            <VscodeFileIcon fileName={file.name} className="mt-1" />
                                            <div className="flex flex-col w-full">
                                                <span className="text-sm font-medium">
                                                    {file.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    <span className="font-medium">{file.repo.split('/').pop()}</span>/{file.path}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                </div>,
                document.body
            )}
        </div>
    )
}

const DefaultElement = (props: RenderElementProps) => {
    return <p {...props.attributes}>{props.children}</p>
}

const Leaf = (props: RenderLeafProps) => {
    return (
        <span
            {...props.attributes}
        >
            {props.children}
        </span>
    )
}

const MentionComponent = ({
    attributes,
    children,
    element: { data },
}: RenderElementPropsFor<MentionElement>) => {
    const selected = useSelected();
    const focused = useFocused();

    return data.type === 'file' && (
        <span
            {...attributes}
            contentEditable={false}
            className={cn(
                "px-1.5 py-0.5 mr-1.5 align-baseline inline-block rounded bg-muted text-xs font-mono",
                {
                    "ring-2 ring-blue-300": selected && focused
                }
            )}
        >
            <span contentEditable={false} className="flex flex-row items-center select-none">
                {/* @see: https://github.com/ianstormtaylor/slate/issues/3490 */}
                {IS_MAC ? (
                    <Fragment>
                        {children}
                        <VscodeFileIcon fileName={data.name} className="w-3 h-3 mr-0.5" />
                        {data.name}
                    </Fragment>
                ) : (
                    <Fragment>
                        <VscodeFileIcon fileName={data.name} className="w-3 h-3 mr-0.5" />
                        {data.name}
                        {children}
                    </Fragment>
                )}
            </span>
        </span>
    )
}
