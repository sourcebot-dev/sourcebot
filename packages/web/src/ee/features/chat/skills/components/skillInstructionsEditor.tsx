'use client';

import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FILE_REFERENCE_REGEX } from "@/features/chat/constants";
import { SuggestionBox } from "@/features/chat/components/chatBox/suggestionsBox";
import type { FileSuggestion, RefineSuggestion, Suggestion, SuggestionMode } from "@/features/chat/components/chatBox/types";
import { useSuggestionModeAndQuery } from "@/features/chat/components/chatBox/useSuggestionModeAndQuery";
import { useSuggestionsData } from "@/features/chat/components/chatBox/useSuggestionsData";
import type { CustomElement, FileMentionData, MentionElement, RenderElementPropsFor } from "@/features/chat/types";
import { useCustomSlateEditor } from "@/features/chat/useCustomSlateEditor";
import { fileReferenceToString, insertMention, isCustomTextElement, isMentionElement, isParagraphElement } from "@/features/chat/utils";
import { useIsMac } from "@/hooks/useIsMac";
import { cn } from "@/lib/utils";
import { computePosition, flip, offset, shift, type VirtualElement } from "@floating-ui/react";
import { Fragment, type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Descendant, insertText } from "slate";
import { Editable, ReactEditor, type RenderElementProps, type RenderLeafProps, Slate, useFocused, useSelected, useSlate } from "slate-react";

interface SkillInstructionsEditorProps {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    ariaDescribedBy?: string;
    className?: string;
    readOnly?: boolean;
}

const getFileName = (path: string) => path.split("/").pop() || path;

const createFileMentionData = (repo: string, path: string): FileMentionData => ({
    type: "file",
    repo,
    path,
    name: getFileName(path),
    language: "",
    revision: "HEAD",
});

const parseInlineInstructions = (text: string): Descendant[] => {
    const children: Descendant[] = [];
    let lastIndex = 0;

    FILE_REFERENCE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FILE_REFERENCE_REGEX.exec(text)) !== null) {
        const [rawReference, repo, path] = match;
        if (!repo || !path) {
            continue;
        }

        if (match.index > lastIndex) {
            children.push({ text: text.slice(lastIndex, match.index) });
        }

        children.push({
            type: "mention",
            data: createFileMentionData(repo, path),
            children: [{ text: "" }],
        });
        lastIndex = match.index + rawReference.length;
    }
    FILE_REFERENCE_REGEX.lastIndex = 0;

    if (lastIndex < text.length) {
        children.push({ text: text.slice(lastIndex) });
    }

    return children.length > 0 ? children : [{ text: "" }];
};

export const skillInstructionsToSlateValue = (value: string): CustomElement[] =>
    value.split("\n").map((line) => ({
        type: "paragraph",
        children: parseInlineInstructions(line),
    }));

const serializeInlineInstructions = (children: Descendant[]): string =>
    children.map((child) => {
        if (isCustomTextElement(child)) {
            return child.text;
        }

        if (isMentionElement(child)) {
            if (child.data.type === "file") {
                return fileReferenceToString({
                    repo: child.data.repo,
                    path: child.data.path,
                });
            }

            return `/${child.data.slug}`;
        }

        if (isParagraphElement(child)) {
            return serializeInlineInstructions(child.children);
        }

        return "";
    }).join("");

export const slateValueToSkillInstructions = (children: Descendant[]): string =>
    children.map((child) => {
        if (isParagraphElement(child)) {
            return serializeInlineInstructions(child.children);
        }

        return serializeInlineInstructions([child]);
    }).join("\n");

const isSkillSuggestion = (suggestion: Suggestion): suggestion is FileSuggestion | RefineSuggestion =>
    suggestion.type === "file" || suggestion.type === "refine";

const toSkillSuggestionMode = (suggestionMode: SuggestionMode): SuggestionMode =>
    suggestionMode === "file" || suggestionMode === "refine" ? suggestionMode : "none";

export const SkillInstructionsEditor = ({
    id,
    value,
    onChange,
    placeholder,
    ariaDescribedBy,
    className,
    readOnly,
}: SkillInstructionsEditorProps) => {
    const editor = useCustomSlateEditor();
    const initialValue = useMemo(() => skillInstructionsToSlateValue(value), [value]);

    const handleChange = useCallback((children: Descendant[]) => {
        const hasContentChange = editor.operations.some((operation) => operation.type !== "set_selection");
        if (!hasContentChange) {
            return;
        }

        onChange(slateValueToSkillInstructions(children));
    }, [editor, onChange]);

    return (
        <Slate
            editor={editor}
            initialValue={initialValue}
            onChange={handleChange}
        >
            <SkillInstructionsEditable
                id={id}
                className={className}
                placeholder={placeholder}
                ariaDescribedBy={ariaDescribedBy}
                readOnly={readOnly}
            />
        </Slate>
    );
};

const SkillInstructionsEditable = ({
    id,
    className,
    placeholder,
    ariaDescribedBy,
    readOnly,
}: Pick<SkillInstructionsEditorProps, "id" | "className" | "placeholder" | "ariaDescribedBy" | "readOnly">) => {
    const suggestionsBoxRef = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    const editor = useSlate();
    const { suggestionQuery, suggestionMode, range } = useSuggestionModeAndQuery();
    const skillSuggestionMode = toSkillSuggestionMode(suggestionMode);
    const { suggestions: rawSuggestions, isLoading } = useSuggestionsData({
        suggestionMode: skillSuggestionMode,
        suggestionQuery,
        selectedRepos: [],
        askCommands: [],
    });
    const suggestions = useMemo(() => rawSuggestions.filter(isSkillSuggestion), [rawSuggestions]);
    const showPlaceholder = Boolean(placeholder && slateValueToSkillInstructions(editor.children).length === 0);

    useEffect(() => {
        setIndex(0);
    }, [skillSuggestionMode, suggestionQuery]);

    const renderElement = useCallback((props: RenderElementProps) => {
        switch (props.element.type) {
            case "mention":
                return <FileMentionComponent {...props as RenderElementPropsFor<MentionElement>} />;
            default:
                return <DefaultElement {...props} />;
        }
    }, []);

    const renderLeaf = useCallback((props: RenderLeafProps) => (
        <span {...props.attributes}>{props.children}</span>
    ), []);

    const onInsertSuggestion = useCallback((suggestion: FileSuggestion | RefineSuggestion) => {
        switch (suggestion.type) {
            case "file":
                insertMention(editor, {
                    type: "file",
                    path: suggestion.path,
                    repo: suggestion.repo,
                    name: suggestion.name,
                    language: suggestion.language,
                    revision: suggestion.revision,
                }, range);
                insertText(editor, " ");
                break;
            case "refine":
                insertText(editor, "file:");
                break;
        }
        ReactEditor.focus(editor);
    }, [editor, range]);

    const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (suggestions.length === 0) {
            return;
        }

        switch (event.key) {
            case "ArrowDown": {
                event.preventDefault();
                setIndex((current) => current >= suggestions.length - 1 ? 0 : current + 1);
                break;
            }
            case "ArrowUp": {
                event.preventDefault();
                setIndex((current) => current <= 0 ? suggestions.length - 1 : current - 1);
                break;
            }
            case "Tab":
            case "Enter": {
                event.preventDefault();
                const suggestion = suggestions[index];
                if (suggestion) {
                    onInsertSuggestion(suggestion);
                }
                break;
            }
        }
    }, [index, onInsertSuggestion, suggestions]);

    useEffect(() => {
        if (!range || !suggestionsBoxRef.current || skillSuggestionMode === "none") {
            return;
        }

        const virtualElement: VirtualElement = {
            getBoundingClientRect: () => ReactEditor.toDOMRange(editor, range).getBoundingClientRect(),
        };

        computePosition(virtualElement, suggestionsBoxRef.current, {
            placement: "bottom-start",
            middleware: [
                offset(2),
                flip({
                    mainAxis: true,
                    crossAxis: false,
                    fallbackPlacements: ["top-start", "bottom-start"],
                    padding: 20,
                }),
                shift({
                    padding: 5,
                }),
            ],
        }).then(({ x, y }) => {
            if (suggestionsBoxRef.current) {
                suggestionsBoxRef.current.style.left = `${x}px`;
                suggestionsBoxRef.current.style.top = `${y}px`;
            }
        });
    }, [editor, index, range, skillSuggestionMode]);

    return (
        <>
            <div className="relative h-full">
                {showPlaceholder && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent px-3 py-2 pb-8 font-mono text-sm leading-relaxed text-muted-foreground opacity-60"
                    >
                        {placeholder}
                    </div>
                )}
                <Editable
                    aria-label="Skill instructions"
                    aria-describedby={ariaDescribedBy}
                    className={cn(
                        "h-full w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-2 pb-8 font-mono text-sm leading-relaxed ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        className,
                    )}
                    id={id}
                    onKeyDown={onKeyDown}
                    readOnly={readOnly}
                    renderElement={renderElement}
                    renderLeaf={renderLeaf}
                    spellCheck={false}
                />
            </div>
            {skillSuggestionMode !== "none" && (
                <SuggestionBox
                    ref={suggestionsBoxRef}
                    selectedIndex={index}
                    onInsertSuggestion={(suggestion) => {
                        if (isSkillSuggestion(suggestion)) {
                            onInsertSuggestion(suggestion);
                        }
                    }}
                    isLoading={isLoading}
                    suggestions={suggestions}
                />
            )}
        </>
    );
};

const DefaultElement = (props: RenderElementProps) => (
    <p {...props.attributes} className="m-0">{props.children}</p>
);

const FileMentionComponent = ({
    attributes,
    children,
    element: { data },
}: RenderElementPropsFor<MentionElement>) => {
    const selected = useSelected();
    const focused = useFocused();
    const isMac = useIsMac();

    if (data.type !== "file") {
        return <span {...attributes}>{children}</span>;
    }

    return (
        <MentionChip
            attributes={attributes}
            content={
                <Fragment>
                    <VscodeFileIcon fileName={data.name} className="w-3 h-3 mr-1" />
                    {data.name}
                </Fragment>
            }
            focused={focused}
            isMac={isMac}
            selected={selected}
            tooltipContent={
                <span className="text-xs font-mono">
                    <span className="font-medium">{data.repo.split("/").pop()}</span>/{data.path}
                </span>
            }
        >
            {children}
        </MentionChip>
    );
};

interface MentionChipProps {
    attributes: RenderElementPropsFor<MentionElement>["attributes"];
    children: ReactNode;
    content: ReactNode;
    focused: boolean;
    isMac: boolean;
    selected: boolean;
    tooltipContent: ReactNode;
}

const MentionChip = ({
    attributes,
    children,
    content,
    focused,
    isMac,
    selected,
    tooltipContent,
}: MentionChipProps) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <span
                {...attributes}
                contentEditable={false}
                className={cn(
                    "mb-1 mr-1.5 inline-block rounded bg-muted px-1.5 py-0.5 align-baseline text-xs font-mono",
                    selected && focused ? "ring-2 ring-blue-300" : undefined,
                )}
            >
                <span contentEditable={false} className="flex select-none flex-row items-center">
                    {isMac ? (
                        <Fragment>
                            {children}
                            {content}
                        </Fragment>
                    ) : (
                        <Fragment>
                            {content}
                            {children}
                        </Fragment>
                    )}
                </span>
            </span>
        </TooltipTrigger>
        <TooltipContent>
            {tooltipContent}
        </TooltipContent>
    </Tooltip>
);
