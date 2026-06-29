import { BrowseHighlightRange, getBrowsePath } from "@/app/(app)/browse/hooks/utils";
import { CreateUIMessage, isToolUIPart, TextUIPart, UIMessagePart } from "ai";
import type { ChatStatus, DynamicToolUIPart, ToolUIPart } from "ai";
import { Descendant, Editor, Point, Range, Transforms } from "slate";
import { ANSWER_TAG, FILE_REFERENCE_PREFIX, FILE_REFERENCE_REGEX } from "./constants";
import {
    CustomEditor,
    CustomText,
    FileReference,
    FileSource,
    LanguageModelInfo,
    MentionData,
    MentionElement,
    ParagraphElement,
    SBChatMessage,
    SBChatMessagePart,
    SBChatMessageToolTypes,
    SearchScope,
    Source,
} from "./types";

export type SBChatToolPart = (ToolUIPart<SBChatMessageToolTypes> | DynamicToolUIPart) & SBChatMessagePart;

export const isSBChatToolPart = (part: SBChatMessagePart): part is SBChatToolPart => {
    return isToolUIPart(part);
};

export const insertMention = (editor: CustomEditor, data: MentionData, target?: Range | null) => {
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
}

// @see: https://github.com/ianstormtaylor/slate/issues/4162#issuecomment-1127062098
export function word(
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

export const isMentionElement = (element: Descendant): element is MentionElement => {
    return 'type' in element && element.type === 'mention';
}

export const isCustomTextElement = (element: Descendant): element is CustomText => {
    return 'text' in element && typeof element.text === 'string';
}

export const isParagraphElement = (element: Descendant): element is ParagraphElement => {
    return 'type' in element && element.type === 'paragraph';
}

export const slateContentToString = (children: Descendant[]): string => {
    return children.map((child) => {
        if (isCustomTextElement(child)) {
            return child.text;
        }

        else if (isMentionElement(child)) {
            const { type } = child.data;

            switch (type) {
                case 'file':
                    return `${fileReferenceToString({ repo: child.data.repo, path: child.data.path })} `;
            }
        }

        else if (isParagraphElement(child)) {
            return `${slateContentToString(child.children)}\n`;
        }

        else {
            return "";
        }
    }).join("");
}

export const getAllMentionElements = (children: Descendant[]): MentionElement[] => {
    return children.flatMap((child) => {
        if (isCustomTextElement(child)) {
            return [];
        }

        if (isMentionElement(child)) {
            return [child];
        }

        return getAllMentionElements(child.children);
    });
}

export const clearEditorHistory = (editor: CustomEditor) => {
    // slate-history exposes `history` publicly, but does not provide a clear API.
    editor.history = { redos: [], undos: [] };
}

// @see: https://stackoverflow.com/a/74102147
export const resetEditor = (editor: CustomEditor) => {
    const point = { path: [0, 0], offset: 0 }
    editor.selection = { anchor: point, focus: point };
    clearEditorHistory(editor);
    editor.children = [{
        type: "paragraph",
        children: [{ text: "" }]
    }];
}

export const addLineNumbers = (source: string, lineOffset = 1) => {
    return source.split('\n').map((line, index) => `${index + lineOffset}: ${line}`).join('\n');
}

export const createUIMessage = (text: string, mentions: MentionData[], selectedSearchScopes: SearchScope[], disabledMcpServerIds: string[] = []): CreateUIMessage<SBChatMessage> => {
    // Converts applicable mentions into sources.
    const sources: Source[] = mentions
        .map((mention) => {
            if (mention.type === 'file') {
                const fileSource: FileSource = {
                    type: 'file',
                    path: mention.path,
                    repo: mention.repo,
                    name: mention.name,
                    revision: mention.revision,
                }
                return fileSource;
            }

            return undefined;
        })
        .filter((source) => source !== undefined);

    return {
        role: 'user',
        parts: [
            {
                type: 'text',
                text,
            },
            ...sources.map((data) => ({
                type: 'data-source',
                data,
            })) as UIMessagePart<{ source: Source }, SBChatMessageToolTypes>[],
        ],
        metadata: {
            selectedSearchScopes,
            disabledMcpServerIds,
        },
    }
}

export const getFileReferenceId = ({ repo, path, range }: Omit<FileReference, 'type' | 'id'>) => {
    return `file-reference-${repo}::${path}${range ? `-${range.startLine}-${range.endLine}` : ''}`;
}

export const fileReferenceToString = ({ repo, path, range }: Omit<FileReference, 'type' | 'id'>) => {
    return `${FILE_REFERENCE_PREFIX}{${repo}::${path}${range ? `:${range.startLine}-${range.endLine}` : ''}}`;
}

export const createFileReference = ({ repo, path, startLine, endLine }: { repo: string, path: string, startLine?: string, endLine?: string }): FileReference => {
    const range = startLine && endLine ? {
        startLine: parseInt(startLine),
        endLine: parseInt(endLine),
    } : startLine ? {
        startLine: parseInt(startLine),
        endLine: parseInt(startLine),
    } : undefined;

    return {
        type: 'file',
        id: getFileReferenceId({ repo, path, range }),
        repo,
        path,
        range,
    }
}

/**
 * Converts LLM text that includes references (e.g., @file:...) into a portable
 * Markdown format. Practically, this means converting references into Markdown
 * links and removing the answer tag.
 */
export const convertLLMOutputToPortableMarkdown = (text: string, baseUrl: string, sources: FileSource[]): string => {
    return text
        .replace(ANSWER_TAG, '')
        .replace(FILE_REFERENCE_REGEX, (_, repo, fileName, startLine, endLine) => {
            const reference = createFileReference({
                repo,
                path: fileName,
                startLine,
                endLine
            });

            const source = tryResolveFileReference(reference, sources);
            if (!source) {
                return fileName;
            }

            let linkText = source.name;
            if (startLine) {
                if (endLine && startLine !== endLine) {
                    linkText += `:${startLine}-${endLine}`;
                } else {
                    linkText += `:${startLine}`;
                }
            }

            // Construct highlight range for line numbers
            const highlightRange: BrowseHighlightRange | undefined = startLine ? {
                start: { lineNumber: parseInt(startLine) },
                end: { lineNumber: parseInt(endLine || startLine) },
            } : undefined;

            // Prefer the pinned commit SHA so copied links resolve to the code
            // as it was when answered; fall back to the symbolic ref.
            const browsePath = getBrowsePath({
                repoName: repo,
                revisionName: source.commitSha ?? source.revision,
                path: fileName,
                pathType: 'blob',
                highlightRange,
            });

            const fullUrl = `${baseUrl}${browsePath}`;
            return `[${linkText}](${fullUrl})`;
        })
        .trim();
}

// Groups message parts into groups based on step-start delimiters.
export const groupMessageIntoSteps = (parts: SBChatMessagePart[]) => {
    if (!parts || parts.length === 0) {
        return [];
    }

    const steps: SBChatMessagePart[][] = [];
    let currentStep: SBChatMessagePart[] = [];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (part.type === 'step-start') {
            if (currentStep.length > 0) {
                steps.push([...currentStep]);
            }
            currentStep = [part];
        } else {
            currentStep.push(part);
        }
    }

    if (currentStep.length > 0) {
        steps.push(currentStep);
    }

    return steps;
}

export const getLastStepParts = (parts: SBChatMessagePart[]): SBChatMessagePart[] => {
    return groupMessageIntoSteps(parts).at(-1) ?? parts;
}

export const getTurnProgressState = ({
    messages,
    status,
}: {
    messages: SBChatMessage[];
    status: ChatStatus;
}) => {
    const isNetworkActive = status === 'submitted' || status === 'streaming';
    const latestMessage = messages.at(-1);
    const latestAssistantMessage = latestMessage?.role === 'assistant' ? latestMessage : undefined;
    const latestStepToolParts = getLastStepParts(latestAssistantMessage?.parts ?? [])
        .filter(isSBChatToolPart);

    const hasPendingToolApproval = latestStepToolParts.some(
        (part) => part.state === 'approval-requested'
    );
    const hasApprovalContinuationReady =
        latestStepToolParts.some((part) => part.state === 'approval-responded') &&
        latestStepToolParts.every((part) =>
            part.state === 'output-available' ||
            part.state === 'output-error' ||
            part.state === 'approval-responded'
        );

    const isReady = status === 'ready';
    const isTurnInProgress =
        isNetworkActive ||
        (isReady && (hasPendingToolApproval || hasApprovalContinuationReady));
    const isAwaitingToolApproval = isReady && hasPendingToolApproval;
    const shouldGuardNavigation = isNetworkActive || (isReady && hasApprovalContinuationReady);

    return {
        isNetworkActive,
        hasPendingToolApproval,
        hasApprovalContinuationReady,
        isAwaitingToolApproval,
        isTurnInProgress,
        shouldGuardNavigation,
    };
}

// LLMs like to not follow instructions... this takes care of some common mistakes they tend to make.
export const repairReferences = (text: string): string => {
    return text
        // Fix missing colon: @file{...} -> @file:{...}
        .replace(/@file\{([^}]+)\}/g, '@file:{$1}')
        // Fix missing braces: @file:filename -> @file:{filename}
        .replace(/@file:([^\s{]\S*?)(\s|[,;!?](?:\s|$)|\.(?:\s|$)|$)/g, '@file:{$1}$2')
        // Fix multiple ranges: keep only first range
        .replace(/@file:\{(.+?):(\d+-\d+),[\d,-]+\}/g, '@file:{$1:$2}')
        // Fix malformed ranges
        .replace(/@file:\{(.+?):(\d+)-(\d+)-(\d+)\}/g, '@file:{$1:$2-$3}')
        // Fix extra closing parenthesis: @file:{...)} -> @file:{...}
        .replace(/@file:\{([^}]+)\)\}/g, '@file:{$1}')
        // Fix extra colon at end: @file:{...range:} -> @file:{...range}
        .replace(/@file:\{(.+?):(\d+(?:-\d+)?):?\}/g, '@file:{$1:$2}')
        // Fix inline code blocks around file references: `@file:{...}` -> @file:{...}
        .replace(/`(@file:\{[^}]+\})`/g, '$1')
        // Fix malformed inline code blocks: `@file:{...`} -> @file:{...}
        .replace(/`(@file:\{[^`]+)`\}/g, '$1}');
};

// Extracts the user's text from a message by finding the first text part.
// User messages may contain non-text parts (e.g., file attachments), so we
// cannot assume the text is always at index 0. Accepts anything carrying
// `parts` so it works for both persisted and freshly created messages.
export const getUserMessageText = (message: Pick<SBChatMessage, 'parts'>): string => {
    return message.parts.find((part) => part.type === 'text')?.text ?? '';
}

// Attempts to find the part of the assistant's message
// that contains the answer.
export const getAnswerPartFromAssistantMessage = (message: SBChatMessage, isTurnInProgress: boolean): TextUIPart | undefined => {
    const lastTextPart = message.parts
        .findLast((part) => part.type === 'text')

    if (lastTextPart?.text.includes(ANSWER_TAG)) {
        const answerIndex = lastTextPart.text.indexOf(ANSWER_TAG);
        const answer = lastTextPart.text.substring(answerIndex + ANSWER_TAG.length);
        return {
            ...lastTextPart,
            text: answer
        };
    }

    // If the agent did not include the answer tag, then fallback to using the last text part.
    // Only do this when the turn is complete since the agent may still be thinking or waiting.
    if (!isTurnInProgress && lastTextPart) {
        return lastTextPart;
    }

    return undefined;
}

/**
 * Generates a unique key for a language model. Accepts any object carrying the
 * identifying fields, so both the full `LanguageModel` config and the
 * client-safe `LanguageModelInfo` can be keyed with it.
 */
export const getLanguageModelKey = (model: Pick<LanguageModelInfo, 'provider' | 'model' | 'displayName'>) => {
    return `${model.provider}-${model.model}-${model.displayName}`;
}

/**
 * Given a file reference and a list of file sources, attempts to resolve the file source that the reference points to.
 */
export const tryResolveFileReference = (reference: FileReference, sources: FileSource[]): FileSource | undefined => {
    const matches = sources.filter(
        (source) => source.repo.endsWith(reference.repo) &&
            source.path.endsWith(reference.path)
    );
    // The same file can be sourced by multiple tools in one turn (e.g. an
    // unpinned `list_tree` listing plus a pinned `read_file`). Prefer a pinned
    // source so citations resolve to the commit the content was read at.
    return matches.find((source) => source.commitSha) ?? matches[0];
};
