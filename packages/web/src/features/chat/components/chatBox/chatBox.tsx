'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CustomEditor, MentionElement, RenderElementPropsFor } from "@/features/chat/types";
import { insertMention, slateContentToString } from "@/features/chat/utils";
import { cn, getCodeHostIcon, IS_MAC } from "@/lib/utils";
import { computePosition, flip, offset, shift, VirtualElement } from "@floating-ui/react";
import { ArrowUp, BookIcon, Loader2, StopCircleIcon } from "lucide-react";
import { Fragment, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Descendant, insertText } from "slate";
import { Editable, ReactEditor, RenderElementProps, RenderLeafProps, useFocused, useSelected, useSlate } from "slate-react";
import { SuggestionBox } from "./suggestionsBox";
import { Suggestion } from "./types";
import { useSuggestionModeAndQuery } from "./useSuggestionModeAndQuery";
import { useSuggestionsData } from "./useSuggestionsData";
import Image from "next/image";

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
    const editor = useSlate();
    const { suggestionQuery, suggestionMode, range } = useSuggestionModeAndQuery();
    const { suggestions, isLoading } = useSuggestionsData({
        suggestionMode,
        suggestionQuery,
        selectedRepos,
    });

    // Reset the index when the suggestion mode changes.
    useEffect(() => {
        setIndex(0);
    }, [suggestionMode]);

    // Hotkey to focus the chat box.
    useHotkeys("/", (e) => {
        e.preventDefault();
        ReactEditor.focus(editor);
    });

    // Auto-focus chat box when the component mounts.
    useEffect(() => {
        ReactEditor.focus(editor);
    }, [editor]);

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
            slateContentToString(editor.children).trim().length > 0 &&
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

    const onInsertSuggestion = useCallback((suggestion: Suggestion) => {
        switch (suggestion.type) {
            case 'file':
                insertMention(editor, {
                    type: 'file',
                    path: suggestion.path,
                    repo: suggestion.repo,
                    name: suggestion.name,
                    language: suggestion.language,
                    revision: suggestion.revision,
                }, range);
                break;
            case 'repo':
                insertMention(editor, {
                    type: 'repo',
                    name: suggestion.name,
                    displayName: suggestion.displayName,
                    codeHostType: suggestion.codeHostType,
                }, range);
                break;
            case 'refine': {
                switch (suggestion.targetSuggestionMode) {
                    case 'repo':
                        insertText(editor, 'repo:');
                        break;
                    case 'file':
                        insertText(editor, 'file:');
                        break;
                }
                break;
            }
        }
        ReactEditor.focus(editor);
    }, [editor, range]);

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
        else if (suggestions.length > 0) {
            switch (event.key) {
                case 'ArrowDown': {
                    event.preventDefault();
                    const prevIndex = index >= suggestions.length - 1 ? 0 : index + 1
                    setIndex(prevIndex)
                    break;
                }
                case 'ArrowUp': {
                    event.preventDefault();
                    const nextIndex = index <= 0 ? suggestions.length - 1 : index - 1
                    setIndex(nextIndex)
                    break;
                }
                case 'Tab':
                case 'Enter': {
                    event.preventDefault();
                    const suggestion = suggestions[index];
                    onInsertSuggestion(suggestion);
                    break;
                }
                case 'Escape': {
                    event.preventDefault();
                    break;
                }
            }
        }
    }, [suggestionMode, suggestions, onSubmit, index, onInsertSuggestion]);

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
    }, [editor, index, range, preferredSuggestionsBoxPlacement]);

    return (
        <div
            className={cn("flex flex-col justify-between gap-0.5 w-full px-3 py-2", className)}
        >
            <Editable
                className="w-full focus-visible:outline-none focus-visible:ring-0 bg-background text-base disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                placeholder="Ask, plan, or search your codebase. @mention files and repos to refine your query."
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
            {suggestionMode !== "none" && (
                <SuggestionBox
                    ref={suggestionsBoxRef}
                    selectedIndex={index}
                    onInsertSuggestion={onInsertSuggestion}
                    isLoading={isLoading}
                    suggestions={suggestions}
                />
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

    if (data.type === 'file') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        {...attributes}
                        contentEditable={false}
                        className={cn(
                            "px-1.5 py-0.5 mr-1.5 mb-1 align-baseline inline-block rounded bg-muted text-xs font-mono",
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
                                    <VscodeFileIcon fileName={data.name} className="w-3 h-3 mr-1" />
                                    {data.name}
                                </Fragment>
                            ) : (
                                <Fragment>
                                    <VscodeFileIcon fileName={data.name} className="w-3 h-3 mr-1" />
                                    {data.name}
                                    {children}
                                </Fragment>
                            )}
                        </span>
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <span className="text-xs font-mono">
                        <span className="font-medium">{data.repo.split('/').pop()}</span>/{data.path}
                    </span>
                </TooltipContent>
            </Tooltip>
        )
    }
    else if (data.type === 'repo') {
        const icon = getCodeHostIcon(data.codeHostType);
        return (
            <span
                {...attributes}
                contentEditable={false}
                className={cn(
                    "px-1.5 py-0.5 mr-1.5 mb-1 align-baseline inline-block rounded bg-muted text-xs font-mono",
                    {
                        "ring-2 ring-blue-300": selected && focused
                    }
                )}
            >
                <span contentEditable={false} className="flex flex-row items-center select-none">
                    {icon ? (
                        <Image
                            src={icon.src}
                            alt={data.codeHostType}
                            className={cn("w-3 h-3 mr-1", icon.className)}
                        />
                    ) : (
                        <BookIcon className="w-3 h-3 mr-1" />
                    )}
                    {data.displayName ?? data.name}
                </span>
            </span>
        )
    }
}
