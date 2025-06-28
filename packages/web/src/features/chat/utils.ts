import { Descendant, Editor, Point, Range, Transforms } from "slate"
import { CustomEditor, CustomText, FileMentionData, MentionElement, ModelProviderInfo, ParagraphElement } from "./types"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { getBrowsePath } from "@/app/[domain]/browse/hooks/useBrowseNavigation"
import { env } from "@/env.mjs"

export const insertMention = (editor: CustomEditor, data: FileMentionData, target?: Range | null) => {
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

export const toString = (children: Descendant[]): string => {
    return children.map((child) => {
        if (isCustomTextElement(child)) {
            return child.text;
        }

        else if (isMentionElement(child)) {
            const { path, repo } = child.data;
            // @todo(mt)
            const url = getBrowsePath(
                {
                    repoName: repo,
                    path,
                    pathType: 'blob',
                    domain: SINGLE_TENANT_ORG_DOMAIN,
                }
            )

            return `[${child.data.name}](${url}) `;
        }

        else if (isParagraphElement(child)) {
            return `${toString(child.children)}\n`;
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

// @see: https://stackoverflow.com/a/74102147
export const resetEditor = (editor: CustomEditor) => {
    const point = { path: [0, 0], offset: 0 }
    editor.selection = { anchor: point, focus: point };
    editor.history = { redos: [], undos: [] };
    editor.children = [{
        type: "paragraph",
        children: [{ text: "" }]
    }];
}

// Adding line numbers to the source code makes it easier for LLMs to
// reference specific ranges within the code.
export const addLineNumbers = (source: string, lineOffset = 1) => {
    return source.split('\n').map((line, index) => `${index + lineOffset}:${line}`).join('\n');
}

export const getConfiguredModelProviderInfo = (): ModelProviderInfo | undefined => {
    if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_MODEL) {
        return {
            provider: 'anthropic',
            model: env.ANTHROPIC_MODEL,
        };
    }

    if (env.OPENAI_API_KEY && env.OPENAI_MODEL) {
        return {
            provider: 'openai',
            model: env.OPENAI_MODEL,
        };
    }

    if (env.GOOGLE_GENERATIVE_AI_API_KEY && env.GOOGLE_GENERATIVE_AI_MODEL) {
        return {
            provider: 'google-generative-ai',
            model: env.GOOGLE_GENERATIVE_AI_MODEL,
        };
    }

    if (
        env.AWS_BEDROCK_MODEL &&
        env.AWS_ACCESS_KEY_ID &&
        env.AWS_SECRET_ACCESS_KEY
    ) {
        return {
            provider: 'aws-bedrock',
            model: env.AWS_BEDROCK_MODEL,
            displayName: env.AWS_BEDROCK_MODEL_DISPLAY_NAME,
        };
    }

    return undefined;
}