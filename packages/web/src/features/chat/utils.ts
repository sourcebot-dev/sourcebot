import { CreateUIMessage, TextUIPart, UIMessagePart } from "ai";
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

export const addLineNumbers = (source: string, lineOffset = 1) => {
    return source.split('\n').map((line, index) => `${index + lineOffset}:${line}`).join('\n');
}

export const createUIMessage = (text: string, mentions: MentionData[], selectedSearchScopes: SearchScope[]): CreateUIMessage<SBChatMessage> => {
    // Converts applicable mentions into sources.
    const sources: Source[] = mentions
        .map((mention) => {
            if (mention.type === 'file') {
                const fileSource: FileSource = {
                    type: 'file',
                    path: mention.path,
                    repo: mention.repo,
                    name: mention.name,
                    language: mention.language,
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
 * Builds a web URL for a file hosted on a code host (GitHub, GitLab, Bitbucket, etc.)
 * 
 * Supported platforms:
 * - GitHub (github.com and GitHub Enterprise)
 * - GitLab (gitlab.com and self-managed)
 * - Bitbucket (bitbucket.org Cloud and Data Center)
 * - Azure DevOps (dev.azure.com and on-premises)
 * - Gitea (self-hosted)
 * - Gerrit (self-hosted)
 * - Generic Git hosts
 * 
 * @param repo - Repository identifier (e.g., 'github.com/owner/repo')
 * @param fileName - File path within the repository
 * @param revision - Branch, tag, or commit SHA
 * @param startLine - Optional starting line number
 * @param endLine - Optional ending line number
 * @returns Full URL to the file on the code host, or the original fileName if URL cannot be constructed
 */
export const buildCodeHostFileUrl = (
    repo: string,
    fileName: string,
    revision: string,
    startLine?: string,
    endLine?: string
): string => {
    try {
        if (!repo) {
            return fileName;
        }

        const filePath = fileName.replace(/^\/+/, '');
        const parts = repo.split('/');
        
        if (parts.length < 2) {
            return fileName;
        }

        const host = parts[0].toLowerCase();
        const ownerRepo = parts.slice(1).join('/');
        let url: string;

        // Check if file is markdown
        const isMarkdown = /\.(md|mdx|markdown)$/i.test(filePath);

        // Detect code host type and construct appropriate URL
        if (host === 'github.com' || host.includes('github')) {
            // GitHub and GitHub Enterprise
            url = `https://${host}/${ownerRepo}/blob/${revision}/${filePath}`;
            // Add ?plain=1 for markdown files to enable line numbers
            if (isMarkdown && startLine) {
                url += `?plain=1#L${startLine}`;
                if (endLine && startLine !== endLine) {
                    url += `-L${endLine}`;
                }
            } else if (startLine) {
                url += `#L${startLine}`;
                if (endLine && startLine !== endLine) {
                    url += `-L${endLine}`;
                }
            }
        } else if (host === 'gitlab.com' || host.includes('gitlab')) {
            // GitLab.com and GitLab Self-Managed
            url = `https://${host}/${ownerRepo}/-/blob/${revision}/${filePath}`;
            if (startLine) {
                url += `#L${startLine}`;
                if (endLine && startLine !== endLine) {
                    url += `-${endLine}`;
                }
            }
        } else if (host === 'bitbucket.org' || host.includes('bitbucket')) {
            // Bitbucket Cloud and Bitbucket Data Center
            url = `https://${host}/${ownerRepo}/src/${revision}/${filePath}`;
            if (startLine) {
                // Bitbucket uses #lines-10 or #lines-10:20
                url += `#lines-${startLine}`;
                if (endLine && startLine !== endLine) {
                    url += `:${endLine}`;
                }
            }
        } else if (host.includes('dev.azure.com') || host.includes('visualstudio.com')) {
            // Azure DevOps Cloud and Server
            // Format: https://dev.azure.com/{org}/{project}/_git/{repo}?path={path}&version=GB{branch}&line={line}&lineEnd={endLine}
            const repoParts = ownerRepo.split('/');
            if (repoParts.length >= 3) {
                const org = repoParts[0];
                const project = repoParts[1];
                const repoName = repoParts.slice(2).join('/');
                url = `https://${host}/${org}/${project}/_git/${repoName}?path=/${filePath}&version=GB${revision}`;
                if (startLine) {
                    url += `&line=${startLine}`;
                    if (endLine && startLine !== endLine) {
                        url += `&lineEnd=${endLine}`;
                    }
                }
            } else {
                return fileName;
            }
        } else if (host.includes('gitea')) {
            // Gitea Self-Hosted
            url = `https://${host}/${ownerRepo}/src/branch/${revision}/${filePath}`;
            if (startLine) {
                url += `#L${startLine}`;
                if (endLine && startLine !== endLine) {
                    url += `-L${endLine}`;
                }
            }
        } else if (host.includes('gerrit')) {
            // Gerrit Self-Hosted
            // Format: https://{host}/plugins/gitiles/{repo}/+/refs/heads/{branch}/{path}#{line}
            url = `https://${host}/plugins/gitiles/${ownerRepo}/+/refs/heads/${revision}/${filePath}`;
            if (startLine) {
                url += `#${startLine}`;
            }
        } else {
            // For unknown hosts, attempt generic git web URL format
            // This works for many Git web interfaces like cgit, gitweb, etc.
            url = `https://${host}/${ownerRepo}/src/branch/${revision}/${filePath}`;
            if (startLine) {
                url += `#L${startLine}`;
                if (endLine && startLine !== endLine) {
                    url += `-L${endLine}`;
                }
            }
        }

        return url;
    } catch (_) {
        // Fallback to the original fileName on any unexpected parsing error.
        return fileName;
    }
}

/**
 * Converts LLM text that includes references (e.g., @file:...) into a portable
 * Markdown format. Practically, this means converting references into Markdown
 * links and removing the answer tag.
 * 
 * @param text - The LLM output text containing file references
 * @param options - Optional configuration
 * @param options.sources - Array of FileSource objects to resolve revisions and repo info
 */
export const convertLLMOutputToPortableMarkdown = (
    text: string, 
    options?: {
        sources?: FileSource[];
    }
): string => {
    return text
        .replace(ANSWER_TAG, '')
        .replace(FILE_REFERENCE_REGEX, (_, repo, fileName, startLine, endLine) => {
            const displayName = fileName.split('/').pop() || fileName;

            let linkText = displayName;
            if (startLine) {
                if (endLine && startLine !== endLine) {
                    linkText += `:${startLine}-${endLine}`;
                } else {
                    linkText += `:${startLine}`;
                }
            }

            // Try to find matching source to get revision info
            const matchingSource = options?.sources?.find(
                (source) => source.repo === repo && source.path === fileName
            );
            const revision = matchingSource?.revision || 'main';

            // Build the URL using the extracted utility function
            const url = buildCodeHostFileUrl(repo, fileName, revision, startLine, endLine);

            return `[${linkText}](${url})`;
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

// Attempts to find the part of the assistant's message
// that contains the answer.
export const getAnswerPartFromAssistantMessage = (message: SBChatMessage, isStreaming: boolean): TextUIPart | undefined => {
    const lastTextPart = message.parts
        .findLast((part) => part.type === 'text')

    if (lastTextPart?.text.startsWith(ANSWER_TAG)) {
        return lastTextPart;
    }

    // If the agent did not include the answer tag, then fallback to using the last text part.
    // Only do this when we are no longer streaming since the agent may still be thinking.
    if (!isStreaming && lastTextPart) {
        return lastTextPart;
    }

    return undefined;
}

export const buildSearchQuery = (options: {
    query: string,
    repoNamesFilter?: string[],
    repoNamesFilterRegexp?: string[],
    languageNamesFilter?: string[],
    fileNamesFilterRegexp?: string[],
}) => {
    const {
        query: _query,
        repoNamesFilter,
        repoNamesFilterRegexp,
        languageNamesFilter,
        fileNamesFilterRegexp,
    } = options;

    let query = `${_query}`;

    if (repoNamesFilter && repoNamesFilter.length > 0) {
        query += ` reposet:${repoNamesFilter.join(',')}`;
    }

    if (languageNamesFilter && languageNamesFilter.length > 0) {
        query += ` ( lang:${languageNamesFilter.join(' or lang:')} )`;
    }

    if (fileNamesFilterRegexp && fileNamesFilterRegexp.length > 0) {
        query += ` ( file:${fileNamesFilterRegexp.join(' or file:')} )`;
    }

    if (repoNamesFilterRegexp && repoNamesFilterRegexp.length > 0) {
        query += ` ( repo:${repoNamesFilterRegexp.join(' or repo:')} )`;
    }

    return query;
}

/**
 * Generates a unique key given a LanguageModelInfo object.
 */
export const getLanguageModelKey = (model: LanguageModelInfo) => {
    return `${model.provider}-${model.model}-${model.displayName}`;
}

/**
 * Given a file reference and a list of file sources, attempts to resolve the file source that the reference points to.
 */
export const tryResolveFileReference = (reference: FileReference, sources: FileSource[]): FileSource | undefined => {
    return sources.find(
        (source) => source.repo.endsWith(reference.repo) &&
            source.path.endsWith(reference.path)
    );
}