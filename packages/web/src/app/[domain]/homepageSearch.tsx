'use client';

import { Separator } from "@/components/ui/separator";
import { SearchBar } from "./components/searchBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AtSignIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RepoSelector } from "./chat/components/repoSelector";
import { useState, useCallback, useEffect, KeyboardEvent, useRef, useMemo, Fragment } from "react";
import { BaseEditor, createEditor, Editor, Element, Descendant, Range, Transforms, Point } from "slate";
import { Slate, Editable, withReact, ReactEditor, RenderElementProps, RenderLeafProps, useSelected, useFocused, useSlateSelection, useSlate } from "slate-react";
import { HistoryEditor, withHistory } from "slate-history";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { search } from "@/features/search/searchApi";
import { cn, IS_MAC, unwrapServiceError } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from '@iconify/react';
import { getIconForFile } from "vscode-icons-js";
import { getRepos } from "@/actions";

type CustomText = { text: string; }

type ParagraphElement = {
    type: 'paragraph'
    align?: string
    children: Descendant[];
}

type FileMentionData = {
    type: 'file';
    repo: string;
    path: string;
    name: string;
    language: string;
}

type MentionElement = {
    type: 'mention';
    data: FileMentionData;
    children: CustomText[];
}

type CustomElement =
    ParagraphElement |
    MentionElement
    ;


type CustomEditor =
    BaseEditor &
    ReactEditor &
    HistoryEditor
    ;

declare module 'slate' {
    interface CustomTypes {
        Editor: CustomEditor
        Element: CustomElement
        Text: CustomText
    }
}

const isMentionElement = (descendant: Descendant): descendant is MentionElement => {
    return 'type' in descendant && descendant.type === 'mention';
}

type RenderElementPropsFor<T> = RenderElementProps & {
    element: T
}

type SearchMode = "precise" | "agentic";

export const HomepageSearch = () => {
    const [searchMode, setSearchMode] = useState<SearchMode>("agentic");
    const [editor] = useState(() => withMentions(withReact(withHistory(createEditor()))));

    return (
        <div className="mt-4 w-full max-w-[800px] border rounded-md">
            {searchMode === "precise" ? (
                <>
                    <SearchBar
                        autoFocus={true}
                        className="border-none pt-0.5 pb-0"
                    />
                    <Separator />
                    <Toolbar
                        searchMode={searchMode}
                        onSearchModeChange={setSearchMode}
                    />
                </>
            ) : (
                <Slate
                    editor={editor}
                    initialValue={initialValue}
                >
                    <AgenticSearchBox
                        onSubmit={(query) => {
                            const mentions = query.children.filter((child) => isMentionElement(child));
                            console.log(mentions);
                        }}
                    />
                    <Separator />
                    <Toolbar
                        searchMode={searchMode}
                        onSearchModeChange={setSearchMode}
                    >
                        <AgenticSearchBoxToolbar />
                    </Toolbar>
                </Slate>
            )}
        </div>
    )
}

interface ToolbarProps {
    searchMode: SearchMode;
    onSearchModeChange: (searchMode: SearchMode) => void;
    children?: React.ReactNode;
}

const Toolbar = ({
    searchMode,
    onSearchModeChange,
    children: tools,
}: ToolbarProps) => {
    return (
        <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
            {tools}
            <div className="flex flex-row items-center ml-auto">
                <p className="text-sm text-muted-foreground mr-1.5">Search mode:</p>
                <Select
                    value={searchMode}
                    onValueChange={(value) => onSearchModeChange(value as SearchMode)}
                >
                    <SelectTrigger
                        className="h-6 mt-0.5 font-mono font-semibold text-xs p-0 w-fit border-none bg-inherit"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="precise">Precise</SelectItem>
                        <SelectItem value="agentic">Agentic</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    )
}

const initialValue: Descendant[] = [
    {
        type: 'paragraph',
        children: [{ text: '' }],
    },
];

type SuggestionMode = "file" | "none";

const AgenticSearchBoxToolbar = () => {
    const domain = useDomain();
    const { data: repos } = useQuery({
        queryKey: ["repos", domain],
        queryFn: () => unwrapServiceError(getRepos(domain)),
    });

    const editor = useSlate();

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-muted-foreground hover:text-primary"
                onClick={() => {
                    editor.insertText("@");
                    ReactEditor.focus(editor);
                }}
            >
                <AtSignIcon className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-3 mx-1" />
            <RepoSelector
                className="bg-inherit w-fit h-6 min-h-6"
                options={repos?.map((repo) => ({
                    value: repo.repoName,
                    label: repo.repoName,
                })) ?? []}
                onValueChange={(value) => console.log(value)}
                maxCount={1}
            />
        </>
    )
}

interface AgenticSearchBoxProps {
    onSubmit: (query: ParagraphElement) => void;
}

const AgenticSearchBox = ({ onSubmit }: AgenticSearchBoxProps) => {
    const suggestionsBoxRef = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    const domain = useDomain();
    const editor = useSlate();
    const selection = useSlateSelection();

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
        queryKey: ["fileSuggestions", suggestionQuery, domain],
        queryFn: () => unwrapServiceError(search({
            query: `file:${suggestionQuery}`,
            matches: 15,
            contextLines: 1,
        }, domain)),
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

    const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (suggestionMode === "none") {
            switch (event.key) {
                case 'Enter': {
                    if (event.shiftKey) {
                        break;
                    }

                    event.preventDefault();
                    const contents = editor.children;
                    const paragraph = contents[0] as ParagraphElement;
                    onSubmit(paragraph);
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
                    insertMention(editor, {
                        type: 'file',
                        repo: suggestion.repo,
                        path: suggestion.path,
                        name: suggestion.name,
                        language: suggestion.language,
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
        if (range && suggestionsBoxRef.current && editor) {
            const el = suggestionsBoxRef.current
            const domRange = ReactEditor.toDOMRange(editor, range)
            const rect = domRange.getBoundingClientRect()
            el.style.top = `${rect.top + window.pageYOffset + 24}px`
            el.style.left = `${rect.left + window.pageXOffset}px`
        }
    }, [editor, index, range]);

    return (
        <div className="w-full px-3 py-2 min-h-[50px]">
            <Editable
                className="w-full rounded-md focus-visible:outline-none focus-visible:ring-0 bg-background text-base disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                placeholder="Ask Sourcebot..."
                autoFocus={true}
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                onKeyDown={onKeyDown}
            />
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
                                    key={file.path}
                                    className={cn("flex flex-row gap-2 w-full cursor-pointer rounded-md px-1 py-0.5", {
                                        "bg-accent": i === index,
                                    })}
                                    onClick={() => {
                                        insertMention(editor, {
                                            type: 'file',
                                            ...file,
                                        }, range);
                                        ReactEditor.focus(editor);
                                    }}
                                >
                                    <FileIcon name={file.name} className="mt-1" />
                                    <div className="flex flex-col w-full">
                                        <span className="text-sm font-medium">
                                            {file.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {file.path}
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

const withMentions = (editor: CustomEditor) => {
    const { isInline, isVoid, markableVoid } = editor;

    editor.isInline = (element: Element) => {
        return element.type === 'mention' ? true : isInline(element)
    }

    editor.isVoid = (element: Element) => {
        return element.type === 'mention' ? true : isVoid(element)
    }

    editor.markableVoid = (element: Element) => {
        return element.type === 'mention' || markableVoid(element)
    }

    return editor
}

const insertMention = (editor: CustomEditor, data: FileMentionData, target?: Range | null) => {
    const mention: MentionElement = {
        type: 'mention',
        data,
        children: [{ text: '' }],
    }

    if (target) {
        Transforms.select(editor, target)
    }

    Transforms.insertNodes(editor, mention)
    Transforms.move(editor)
    Transforms.insertText(editor, ' ')
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
                "px-1.5 py-0.5 mx-0.5 align-baseline inline-block rounded bg-muted text-xs font-mono",
                {
                    "ring-2 ring-blue-300": selected && focused
                }
            )}
        >
            <div contentEditable={false} className="flex flex-row items-center select-none">
                {/* @see: https://github.com/ianstormtaylor/slate/issues/3490 */}
                {IS_MAC ? (
                    <Fragment>
                        {children}
                        <FileIcon name={data.name} className="w-3 h-3 mr-0.5" />
                        {data.name}
                    </Fragment>
                ) : (
                    <Fragment>
                        <FileIcon name={data.name} className="w-3 h-3 mr-0.5" />
                        {data.name}
                        {children}
                    </Fragment>
                )}
            </div>
        </span>
    )
}

const FileIcon = ({ name, className }: { name: string, className?: string }) => {
    const iconName = useMemo(() => {
        const icon = getIconForFile(name);
        if (icon) {
            const iconName = `vscode-icons:${icon.substring(0, icon.indexOf('.')).replaceAll('_', '-')}`;
            return iconName;
        }

        return "vscode-icons:file-type-unknown";
    }, [name]);

    return <Icon icon={iconName} className={cn("w-4 h-4 flex-shrink-0", className)} />;
}

// @see: https://github.com/ianstormtaylor/slate/issues/4162#issuecomment-1127062098
function word(
    editor: CustomEditor,
    location: Range,
    options: {
        terminator?: string[]
        include?: boolean
        directions?: 'both' | 'left' | 'right'
    } = {},
): Range | undefined {
    const { terminator = [' '], include = false, directions = 'both' } = options

    const { selection } = editor
    if (!selection) return

    // Get start and end, modify it as we move along.
    let [start, end] = Range.edges(location)

    let point: Point = start

    function move(direction: 'right' | 'left'): boolean {
        const next =
            direction === 'right'
                ? Editor.after(editor, point, {
                    unit: 'character',
                })
                : Editor.before(editor, point, { unit: 'character' })

        const wordNext =
            next &&
            Editor.string(
                editor,
                direction === 'right' ? { anchor: point, focus: next } : { anchor: next, focus: point },
            )

        const last = wordNext && wordNext[direction === 'right' ? 0 : wordNext.length - 1]
        if (next && last && !terminator.includes(last)) {
            point = next

            if (point.offset === 0) {
                // Means we've wrapped to beginning of another block
                return false
            }
        } else {
            return false
        }

        return true
    }

    // Move point and update start & end ranges

    // Move forwards
    if (directions !== 'left') {
        point = end
        while (move('right'));
        end = point
    }

    // Move backwards
    if (directions !== 'right') {
        point = start
        while (move('left'));
        start = point
    }

    if (include) {
        return {
            anchor: Editor.before(editor, start, { unit: 'offset' }) ?? start,
            focus: Editor.after(editor, end, { unit: 'offset' }) ?? end,
        }
    }

    return { anchor: start, focus: end }
}