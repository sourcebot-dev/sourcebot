'use client';

import { Separator } from "@/components/ui/separator";
import { SearchBar } from "./components/searchBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AtSignIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RepoSelector } from "./chat/components/repoSelector";
import { useState, useCallback, useEffect, KeyboardEvent, useRef, useMemo } from "react";
import { BaseEditor, createEditor, Editor, Element, Descendant, Range, Transforms, Point } from "slate";
import { Slate, Editable, withReact, ReactEditor, RenderElementProps, RenderLeafProps, useSelected, useFocused } from "slate-react";
import { withHistory } from "slate-history";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useDomain } from "@/hooks/useDomain";
import { search } from "@/features/search/searchApi";
import { cn, unwrapServiceError } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from '@iconify/react';
import { getIconForFile } from "vscode-icons-js";

type CustomText = {
    text: string;
}

type ParagraphElement = {
    type: 'paragraph'
    align?: string
    children: CustomText[]
}

type MentionElement = {
    type: 'mention'
    name: string
    children: CustomText[]
}

type CustomElement =
    ParagraphElement |
    MentionElement
    ;


type CustomEditor = BaseEditor & ReactEditor

declare module 'slate' {
    interface CustomTypes {
        Editor: CustomEditor
        Element: CustomElement
        Text: CustomText
    }
}

type RenderElementPropsFor<T> = RenderElementProps & {
    element: T
}


export const HomepageSearch = () => {
    // @todo: use local storage
    const [searchMode, setSearchMode] = useState<"precise" | "agentic">("agentic");

    return (
        <div className="mt-4 w-full max-w-[800px] border rounded-md">
            {searchMode === "precise" ? (
                <SearchBar
                    autoFocus={true}
                    className="border-none pt-0.5 pb-0"
                />
            ) : (
                <AgenticSearch />
            )}
            <Separator />
            {/* Toolbar */}
            <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                {searchMode === "agentic" && (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 text-muted-foreground hover:text-primary"
                            onClick={() => console.log("add context")}
                        >
                            <AtSignIcon className="w-4 h-4" />
                        </Button>
                        <Separator orientation="vertical" className="h-3 mx-1" />
                        <RepoSelector
                            className="bg-inherit w-fit h-6 min-h-6"
                            options={[
                                {
                                    value: "sourcebot-dev/sourcebot",
                                    label: "sourcebot-dev/sourcebot",
                                },
                                {
                                    value: "sourcebot-dev/sourcebot-cli",
                                    label: "sourcebot-dev/sourcebot-cli",
                                },
                                {
                                    value: "sourcebot-dev/sourcebot-ui",
                                    label: "sourcebot-dev/sourcebot-ui",
                                },
                            ]}
                            onValueChange={(value) => console.log(value)}
                            maxCount={1}
                        />
                    </>
                )}
                <div className="flex flex-row items-center ml-auto">
                    <p className="text-sm text-muted-foreground mr-1.5">Search mode:</p>
                    <Select
                        value={searchMode}
                        onValueChange={(value) => setSearchMode(value as "precise" | "agentic")}
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

const AgenticSearch = () => {
    const [editor] = useState(() => withMentions(withReact(withHistory(createEditor()))));
    const suggestionsBoxRef = useRef<HTMLDivElement>(null);

    const [selection, setSelection] = useState<Range | null>(null);
    const [index, setIndex] = useState(0);
    const domain = useDomain();

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

    const { data: fileSuggestions, isLoading: isLoadingFileSuggestions } = useQuery({
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
        if (range && fileSuggestions && fileSuggestions.length > 0) {
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
                    insertMention(editor, fileSuggestions[index].name, range);
                    break;
                }
                case 'Escape': {
                    event.preventDefault();
                    setSelection(null);
                    break;
                }
            }
        }
    }, [fileSuggestions, index, range, editor]);

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
        <Slate
            editor={editor}
            initialValue={initialValue}
            onChange={() => {
                const { selection } = editor;
                setSelection(selection);
            }}
        >
            <Editable
                className="w-full rounded-md focus-visible:outline-none focus-visible:ring-0 bg-background px-3 py-2 text-base disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
                    {isLoadingFileSuggestions ? (
                        <div className="animate-pulse flex flex-col gap-2 px-1 py-0.5 w-full">
                            {
                                Array.from({ length: 10 }).map((_, index) => (
                                    <Skeleton key={index} className="h-4 w-full" />
                                ))
                            }
                        </div>
                    ) : (
                        <div className="flex flex-col w-full">
                            {fileSuggestions?.map((file, i) => (
                                <div
                                    key={file.path}
                                    className={cn("flex flex-row gap-2 w-full cursor-pointer rounded-md px-1 py-0.5", {
                                        "bg-accent": i === index,
                                    })}
                                    onClick={() => {
                                        insertMention(editor, file.name, range);
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
        </Slate>
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

const insertMention = (editor: CustomEditor, name: string, target?: Range | null) => {
    const mention: MentionElement = {
        type: 'mention',
        name,
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
    element,
}: RenderElementPropsFor<MentionElement>) => {
    const selected = useSelected()
    const focused = useFocused()

    return (
        <span
            {...attributes}
            contentEditable={false}
            data-cy={`mention-${element.name.replace(' ', '-')}`}
            className={cn(
                "px-1.5 py-0.5 mx-0.5 align-baseline inline-block rounded bg-muted text-xs",
                {
                    "ring-2 ring-blue-300": selected && focused
                }
            )}
        >
            <div contentEditable={false}>
                <span className="font-mono">
                    {element.name}
                </span>
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