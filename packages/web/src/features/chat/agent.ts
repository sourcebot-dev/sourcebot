import { SBChatMessage, SBChatMessageMetadata } from "@/features/chat/types";
import { getAnswerPartFromAssistantMessage } from "@/features/chat/utils";
import { getFileSource } from '@/features/git';
import { captureEvent } from "@/lib/posthog";
import { isServiceError } from "@/lib/utils";
import { LanguageModelV3 as AISDKLanguageModelV3 } from "@ai-sdk/provider";
import { ProviderOptions } from "@ai-sdk/provider-utils";
import { createLogger, env } from "@sourcebot/shared";
import {
    createUIMessageStream, JSONValue, LanguageModel, ModelMessage, StopCondition, streamText, StreamTextResult,
    UIMessageStreamOnFinishCallback,
    UIMessageStreamOptions,
    UIMessageStreamWriter
} from "ai";
import { randomUUID } from "crypto";
import _dedent from "dedent";
import { ANSWER_TAG, FILE_REFERENCE_PREFIX } from "./constants";
import { findSymbolReferencesDefinition } from "@/features/tools/findSymbolReferences";
import { findSymbolDefinitionsDefinition } from "@/features/tools/findSymbolDefinitions";
import { readFileDefinition } from "@/features/tools/readFile";
import { grepDefinition } from "@/features/tools/grep";
import { Source } from "./types";
import { addLineNumbers, fileReferenceToString } from "./utils";
import { tools } from "./tools";

const dedent = _dedent.withOptions({ alignValues: true });

const logger = createLogger('chat-agent');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mergeStreamAsync = async (stream: StreamTextResult<any, any>, writer: UIMessageStreamWriter<SBChatMessage>, options: UIMessageStreamOptions<SBChatMessage> = {}) => {
    await new Promise<void>((resolve) => writer.merge(stream.toUIMessageStream({
        ...options,
        onFinish: async () => {
            resolve();
        }
    })));
}

interface CreateMessageStreamResponseProps {
    chatId: string;
    messages: SBChatMessage[];
    selectedRepos: string[];
    model: AISDKLanguageModelV3;
    modelName: string;
    onFinish: UIMessageStreamOnFinishCallback<SBChatMessage>;
    onError: (error: unknown) => string;
    modelProviderOptions?: Record<string, Record<string, JSONValue>>;
    metadata?: Partial<SBChatMessageMetadata>;
}

export const createMessageStream = async ({
    chatId,
    messages,
    metadata,
    selectedRepos,
    model,
    modelName,
    modelProviderOptions,
    onFinish,
    onError,
}: CreateMessageStreamResponseProps) => {
    const latestMessage = messages[messages.length - 1];
    const sources = latestMessage.parts
        .filter((part) => part.type === 'data-source')
        .map((part) => part.data);

    const traceId = randomUUID();

    // Extract user messages and assistant answers.
    // We will use this as the context we carry between messages.
    const messageHistory =
        messages.map((message): ModelMessage | undefined => {
            if (message.role === 'user') {
                return {
                    role: 'user',
                    content: message.parts[0].type === 'text' ? message.parts[0].text : '',
                };
            }

            if (message.role === 'assistant') {
                const answerPart = getAnswerPartFromAssistantMessage(message, false);
                if (answerPart) {
                    return {
                        role: 'assistant',
                        content: [answerPart]
                    }
                }
            }
        }).filter(message => message !== undefined);

    const stream = createUIMessageStream<SBChatMessage>({
        execute: async ({ writer }) => {
            writer.write({
                type: 'start',
            });

            const startTime = new Date();

            const researchStream = await createAgentStream({
                model,
                providerOptions: modelProviderOptions,
                inputMessages: messageHistory,
                inputSources: sources,
                selectedRepos,
                onWriteSource: (source) => {
                    writer.write({
                        type: 'data-source',
                        data: source,
                    });
                },
                traceId,
                chatId,
            });

            await mergeStreamAsync(researchStream, writer, {
                sendReasoning: true,
                sendStart: false,
                sendFinish: false,
            });

            const totalUsage = await researchStream.totalUsage;

            writer.write({
                type: 'message-metadata',
                messageMetadata: {
                    totalTokens: totalUsage.totalTokens,
                    totalInputTokens: totalUsage.inputTokens,
                    totalOutputTokens: totalUsage.outputTokens,
                    totalResponseTimeMs: new Date().getTime() - startTime.getTime(),
                    modelName,
                    traceId,
                    ...metadata,
                }
            });

            writer.write({
                type: 'finish',
            });
        },
        onError,
        originalMessages: messages,
        onFinish,
    });

    return stream;
};

interface AgentOptions {
    model: LanguageModel;
    providerOptions?: ProviderOptions;
    selectedRepos: string[];
    inputMessages: ModelMessage[];
    inputSources: Source[];
    onWriteSource: (source: Source) => void;
    traceId: string;
    chatId: string;
}

const createAgentStream = async ({
    model,
    providerOptions,
    inputMessages,
    inputSources,
    selectedRepos,
    onWriteSource,
    traceId,
    chatId,
}: AgentOptions) => {
    // For every file source, resolve the source code so that we can include it in the system prompt.
    const fileSources = inputSources.filter((source) => source.type === 'file');
    const resolvedFileSources = (
        await Promise.all(fileSources.map(async (source) => {
            const fileSource = await getFileSource({
                path: source.path,
                repo: source.repo,
                ref: source.revision,
            }, { source: 'sourcebot-ask-agent' });

            if (isServiceError(fileSource)) {
                logger.error("Error fetching file source:", fileSource);
                return undefined;
            }

            return {
                path: fileSource.path,
                source: fileSource.source,
                repo: fileSource.repo,
                language: fileSource.language,
                revision: source.revision,
            };
        }))
    ).filter((source) => source !== undefined);

    const systemPrompt = createPrompt({
        repos: selectedRepos,
        files: resolvedFileSources,
    });

    const stream = streamText({
        model,
        providerOptions,
        messages: inputMessages,
        system: systemPrompt,
        tools,
        temperature: env.SOURCEBOT_CHAT_MODEL_TEMPERATURE,
        stopWhen: [
            stepCountIsGTE(env.SOURCEBOT_CHAT_MAX_STEP_COUNT),
        ],
        toolChoice: "auto",
        onStepFinish: ({ toolResults }) => {
            toolResults.forEach(({ toolName, output, dynamic }) => {
                captureEvent('wa_chat_tool_used', {
                    chatId,
                    toolName,
                    success: !isServiceError(output),
                });

                if (dynamic || isServiceError(output)) {
                    return;
                }

                if (toolName === readFileDefinition.name) {
                    onWriteSource({
                        type: 'file',
                        language: output.metadata.language,
                        repo: output.metadata.repo,
                        path: output.metadata.path,
                        revision: output.metadata.revision,
                        name: output.metadata.path.split('/').pop() ?? output.metadata.path,
                    });
                } else if (toolName === grepDefinition.name) {
                    output.metadata.files.forEach((file) => {
                        onWriteSource({
                            type: 'file',
                            language: file.language,
                            repo: file.repo,
                            path: file.fileName,
                            revision: file.revision,
                            name: file.fileName.split('/').pop() ?? file.fileName,
                        });
                    });
                } else if (toolName === findSymbolDefinitionsDefinition.name || toolName === findSymbolReferencesDefinition.name) {
                    output.metadata.files.forEach((file) => {
                        onWriteSource({
                            type: 'file',
                            language: file.language,
                            repo: file.repo,
                            path: file.fileName,
                            revision: file.revision,
                            name: file.fileName.split('/').pop() ?? file.fileName,
                        });
                    });
                }
            });
        },
        experimental_telemetry: {
            isEnabled: env.SOURCEBOT_TELEMETRY_PII_COLLECTION_ENABLED === 'true',
            metadata: {
                langfuseTraceId: traceId,
            },
        },
        onError: (error) => {
            logger.error(error);
        },
    });

    return stream;
}

const createPrompt = ({
    files,
    repos,
}: {
    files?: {
        path: string;
        source: string;
        repo: string;
        language: string;
        revision: string;
    }[],
    repos: string[],
}) => {
    return dedent`
    You are a powerful agentic AI code assistant built into Sourcebot, the world's best code-intelligence platform. Your job is to help developers understand and navigate their large codebases.

    <workflow>
    Your workflow has two distinct phases:

    **Phase 1: Research & Analysis**
    - Analyze the user's question and determine what context you need
    - Use available tools to gather code, search repositories, find references, etc.
    - Think through the problem and collect all relevant information
    - Do NOT provide partial answers or explanations during this phase

    **Phase 2: Structured Response**
    - **MANDATORY**: You MUST always enter this phase and provide a structured markdown response, regardless of whether phase 1 was completed or interrupted
    - Provide your final response based on whatever context you have available
    - Always format your response according to the required response format below
    </workflow>

    <research_phase_instructions>
    During the research phase, use the tools available to you to gather comprehensive context before answering. Always explain why you're using each tool. Depending on the user's question, you may need to use multiple tools. If the question is vague, ask the user for more information.
    </research_phase_instructions>

    ${repos.length > 0 ? dedent`
        <selected_repositories>
        The user has explicitly selected the following repositories for analysis:
        ${repos.map(repo => `- ${repo}`).join('\n')}

        When calling tools that accept a \`repo\` parameter (e.g. \`read_file\`, \`list_commits\`, \`list_tree\`, \`grep\`), use these repository names directly.
        </selected_repositories>
    ` : ''}

    ${(files && files.length > 0) ? dedent`
        <files>
        The user has mentioned the following files, which are automatically included for analysis.

        ${files?.map(file => `<file path="${file.path}" repository="${file.repo}" language="${file.language}" revision="${file.revision}">
            ${addLineNumbers(file.source)}
            </file>`).join('\n\n')}
        </files>
    `: ''}

    <answer_instructions>
    When you have sufficient context, output your answer as a structured markdown response.

    **Required Response Format:**
    - **CRITICAL**: You MUST always prefix your answer with a \`${ANSWER_TAG}\` tag at the very top of your response
    - **CRITICAL**: You MUST provide your complete response in markdown format with embedded code references
    - **CODE REFERENCE REQUIREMENT**: Whenever you mention, discuss, or refer to ANY specific part of the code (files, functions, variables, methods, classes, imports, etc.), you MUST immediately follow with a code reference using the format \`${fileReferenceToString({ repo: 'repository', path: 'filename' })}\` or \`${fileReferenceToString({ repo: 'repository', path: 'filename', range: { startLine: 1, endLine: 10 } })}\` (where the numbers are the start and end line numbers of the code snippet). This includes:
    - Files (e.g., "The \`auth.ts\` file" → must include \`${fileReferenceToString({ repo: 'repository', path: 'auth.ts' })}\`)
    - Function names (e.g., "The \`getRepos()\` function" → must include \`${fileReferenceToString({ repo: 'repository', path: 'auth.ts', range: { startLine: 15, endLine: 20 } })}\`)
    - Variable names (e.g., "The \`suggestionQuery\` variable" → must include \`${fileReferenceToString({ repo: 'repository', path: 'search.ts', range: { startLine: 42, endLine: 42 } })}\`)
    - Any code snippet or line you're explaining
    - Class names, method calls, imports, etc.
    - Some examples of both correct and incorrect code references:
    - Correct: @file:{repository::path/to/file.ts}
    - Correct: @file:{repository::path/to/file.ts:10-15}
    - Incorrect: @file{repository::path/to/file.ts} (missing colon)
    - Incorrect: @file:repository::path/to/file.ts (missing curly braces)
    - Incorrect: @file:{repository::path/to/file.ts:10-25,30-35} (multiple ranges not supported)
    - Incorrect: @file:{path/to/file.ts} (missing repository)
    - Be clear and very concise. Use bullet points where appropriate
    - Do NOT explain code without providing the exact location reference. Every code mention requires a corresponding \`${FILE_REFERENCE_PREFIX}\` reference
    - If you cannot provide a code reference for something you're discussing, do not mention that specific code element
    - Always prefer to use \`${FILE_REFERENCE_PREFIX}\` over \`\`\`code\`\`\` blocks.

    **Example answer structure:**
    \`\`\`markdown
    ${ANSWER_TAG}
    Authentication in Sourcebot is built on NextAuth.js with a session-based approach using JWT tokens and Prisma as the database adapter ${fileReferenceToString({ repo: 'github.com/sourcebot-dev/sourcebot', path: 'auth.ts', range: { startLine: 135, endLine: 140 } })}. The system supports multiple authentication providers and implements organization-based authorization with role-defined permissions.
    \`\`\`
    </answer_instructions>
    `
}

// If the agent exceeds the step count, then we will stop.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stepCountIsGTE = (stepCount: number): StopCondition<any> => {
    return ({ steps }) => steps.length >= stepCount;
}
