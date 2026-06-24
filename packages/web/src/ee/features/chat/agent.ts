import { SBChatMessage, SBChatMessageMetadata, StepTokenUsageEntry, ToolTokenUsageEntry } from "@/features/chat/types";
import { estimateModelToolOutputTokens } from "@/ee/features/chat/tokenEstimation";
import { getFileSource } from '@/features/git';
import { isServiceError } from "@/lib/utils";
import { LanguageModelV3 as AISDKLanguageModelV3 } from "@ai-sdk/provider";
import { ProviderOptions } from "@ai-sdk/provider-utils";
import type { PrismaClient } from "@sourcebot/db";
import { createLogger, env } from "@sourcebot/shared";
import {
    convertToModelMessages,
    createUIMessageStream, JSONValue, LanguageModel, ModelMessage, StopCondition, streamText, StreamTextResult,
    SystemModelMessage,
    UIMessageStreamOnFinishCallback,
    UIMessageStreamOptions,
    UIMessageStreamWriter,
    tool,
    Tool,
    NoSuchToolError,
} from "ai";
import { z } from "zod";
import { randomUUID } from "crypto";
import _dedent from "dedent";
import { ANSWER_TAG, FILE_REFERENCE_PREFIX } from "@/features/chat/constants";
import { Source } from "@/features/chat/types";
import { addLineNumbers, fileReferenceToString, getAnswerPartFromAssistantMessage, getTurnProgressState } from "@/features/chat/utils";
import { createTools } from "./tools";
import { getConnectedMcpClients } from "@/ee/features/chat/mcp/mcpClientFactory";
import { getMcpTools, McpToolsResult } from "@/ee/features/chat/mcp/mcpToolSets";
import { buildMcpToolRegistry, McpToolRegistryEntry, searchMcpTools } from "@/ee/features/chat/mcp/mcpToolRegistry";
import { PromptCacheStrategy, mergeProviderOptions, detectPromptCacheBreak, detectUnexpectedCacheMiss } from "./promptCaching";
import { hasEntitlement } from '@/lib/entitlements';

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
    prisma: PrismaClient;
    // When undefined, MCP tools are disabled entirely (e.g. programmatic callers like askCodebase).
    // When an array, MCP tools are enabled for all servers not in the list.
    disabledMcpServerIds?: string[];
    model: AISDKLanguageModelV3;
    modelName: string;
    promptCacheStrategy: PromptCacheStrategy;
    onFinish: UIMessageStreamOnFinishCallback<SBChatMessage>;
    onError: (error: unknown) => string;
    modelProviderOptions?: Record<string, Record<string, JSONValue>>;
    modelTemperature?: number;
    metadata?: Partial<SBChatMessageMetadata>;
    userId?: string;
    orgId?: number;
}

export const createMessageStream = async ({
    chatId,
    messages,
    metadata,
    selectedRepos,
    prisma,
    disabledMcpServerIds,
    model,
    modelName,
    promptCacheStrategy,
    modelProviderOptions,
    modelTemperature,
    onFinish,
    onError,
    userId,
    orgId,
}: CreateMessageStreamResponseProps) => {
    // Defense-in-depth: Ask Sourcebot is a paid feature. Every caller is
    // expected to gate on the `ask` entitlement before reaching here (see
    // checkAskEntitlement); this assertion backstops that contract so a future
    // ungated caller cannot execute the agent on a non-entitled deployment.
    if (!(await hasEntitlement('ask'))) {
        throw new Error('Ask Sourcebot is not available in the current plan.');
    }

    const latestMessage = messages[messages.length - 1];
    const sources = latestMessage.parts
        .filter((part) => part.type === 'data-source')
        .map((part) => part.data);

    const traceId = randomUUID();

    // Extract user messages and assistant answers.
    // We will use this as the context we carry between messages.
    // Server requests always receive persisted messages between client streams, so evaluate them in the ready state.
    const incomingTurnProgress = getTurnProgressState({ messages, status: 'ready' });
    let messageHistory: ModelMessage[] =
        messages.map((message, index): ModelMessage | undefined => {
            if (message.role === 'user') {
                return {
                    role: 'user',
                    content: message.parts[0].type === 'text' ? message.parts[0].text : '',
                };
            }

            if (message.role === 'assistant') {
                const isLatestIncompleteAssistantMessage =
                    index === messages.length - 1 &&
                    incomingTurnProgress.isTurnInProgress;
                const answerPart = getAnswerPartFromAssistantMessage(message, isLatestIncompleteAssistantMessage);
                if (answerPart) {
                    return {
                        role: 'assistant',
                        content: [answerPart]
                    }
                }
            }
        }).filter(message => message !== undefined);

    // When the last assistant turn has approval responses (from the tool approval flow),
    // the turn is incomplete — it has no answer text, only a pending tool call that was
    // approved. We need to preserve the full tool call + approval so streamText can
    // execute the approved tool and continue.
    const lastMsg = messages[messages.length - 1];
    const hasApprovalContinuationReady =
        lastMsg?.role === 'assistant' &&
        incomingTurnProgress.hasApprovalContinuationReady;

    // When continuing after tool approval, capture the prior turn's metadata
    // so we can aggregate token counts and response times across phases.
    const priorMetadata = hasApprovalContinuationReady
        ? (lastMsg.metadata as SBChatMessageMetadata | undefined)
        : undefined;

    if (hasApprovalContinuationReady) {
        const fullLastTurn = await convertToModelMessages(
            [lastMsg],
            { ignoreIncompleteToolCalls: true }
        );
        messageHistory = [...messageHistory, ...fullLastTurn];
    }

    const stream = createUIMessageStream<SBChatMessage>({
        execute: async ({ writer }) => {
            writer.write({
                type: 'start',
            });

            const startTime = new Date();

            const researchStream = await createAgentStream({
                model,
                promptCacheStrategy,
                providerOptions: modelProviderOptions,
                temperature: modelTemperature,
                inputMessages: messageHistory,
                inputSources: sources,
                selectedRepos,
                disabledMcpServerIds,
                onWriteSource: (source) => {
                    writer.write({
                        type: 'data-source',
                        data: source,
                    });
                },
                onMcpServerDiscovered: (sanitizedName, faviconUrl) => {
                    writer.write({
                        type: 'data-mcp-server',
                        data: { sanitizedName, faviconUrl },
                    });
                },
                onMcpServerFailed: (serverName) => {
                    writer.write({
                        type: 'data-mcp-failed-server',
                        data: { serverName },
                    });
                },
                traceId,
                chatId,
                prisma,
                userId,
                orgId,
            });

            await mergeStreamAsync(researchStream, writer, {
                originalMessages: messages,
                sendReasoning: true,
                sendStart: false,
                sendFinish: false,
            });

            const totalUsage = await researchStream.totalUsage;
            const steps = await researchStream.steps;
            const response = await researchStream.response;

            // Tool output estimates are derived from `response.messages` rather
            // than per-step `toolResults` because the response messages cover
            // tool calls that never run inside a step — approval-gated tools
            // execute before the step loop, and thrown tool errors are recorded
            // as `tool-error` parts that `toolResults` excludes. Their
            // `tool-result` parts also carry the output in model-visible form
            // (`toModelOutput` already applied), which is exactly the payload
            // whose token footprint we want to estimate.
            const toolUsageByToolCallId = new Map<string, ToolTokenUsageEntry>(
                response.messages.flatMap((message) =>
                    message.role !== 'tool' ? [] : message.content.flatMap((part) =>
                        part.type !== 'tool-result' ? [] : [[part.toolCallId, {
                            toolCallId: part.toolCallId,
                            toolName: part.toolName,
                            estimatedOutputTokens: estimateModelToolOutputTokens(part.output),
                        }] as const]
                    )
                )
            );

            // One entry per step, in step order. The UI joins its step groups
            // to these entries by array position, so the order and count must
            // mirror the stream's steps exactly. Tool calls nest under the
            // step they ran in; `content` is matched rather than `toolResults`
            // so that thrown tool errors (`tool-error` parts, which
            // `toolResults` excludes) are still attributed to their step.
            const stepTokenUsage: StepTokenUsageEntry[] = steps.map(({ usage, content }) => ({
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens,
                tools: content.flatMap((part) => {
                    if (part.type !== 'tool-result' && part.type !== 'tool-error') {
                        return [];
                    }
                    const entry = toolUsageByToolCallId.get(part.toolCallId);
                    if (!entry) {
                        return [];
                    }
                    toolUsageByToolCallId.delete(part.toolCallId);
                    return [entry];
                }),
            }));

            // Any estimates left unclaimed belong to tool calls that executed
            // before the step loop (approval continuations). Their output
            // enters the context as input to this phase's first step, so nest
            // them under it.
            if (toolUsageByToolCallId.size > 0 && stepTokenUsage.length > 0) {
                stepTokenUsage[0].tools.unshift(...toolUsageByToolCallId.values());
            }

            // Observability only (default off): warn when a continuation step
            // reports zero cache reads while the provider supports breakpoints —
            // a likely byte-stability regression in the cached prefix.
            if (env.SOURCEBOT_CHAT_PROMPT_CACHE_BREAK_DETECTION_ENABLED === 'true') {
                steps.forEach((step, stepIndex) => {
                    detectUnexpectedCacheMiss({
                        chatId,
                        stepIndex,
                        cacheReadTokens: step.usage.inputTokenDetails?.cacheReadTokens,
                        supportsBreakpoints: promptCacheStrategy.supportsBreakpoints,
                    });
                });
            }

            writer.write({
                type: 'message-metadata',
                messageMetadata: {
                    // Spread first so the derived fields below can't be overwritten by caller metadata.
                    ...metadata,
                    totalTokens: (priorMetadata?.totalTokens ?? 0) + (totalUsage.totalTokens ?? 0),
                    totalInputTokens: (priorMetadata?.totalInputTokens ?? 0) + (totalUsage.inputTokens ?? 0),
                    totalOutputTokens: (priorMetadata?.totalOutputTokens ?? 0) + (totalUsage.outputTokens ?? 0),
                    totalCacheReadTokens: (priorMetadata?.totalCacheReadTokens ?? 0) + (totalUsage.inputTokenDetails?.cacheReadTokens ?? 0),
                    totalCacheWriteTokens: (priorMetadata?.totalCacheWriteTokens ?? 0) + (totalUsage.inputTokenDetails?.cacheWriteTokens ?? 0),
                    totalResponseTimeMs: (priorMetadata?.totalResponseTimeMs ?? 0) + (new Date().getTime() - startTime.getTime()),
                    // Concatenated (not summed) across approval-continuation
                    // phases so earlier phases' steps are preserved in order.
                    stepTokenUsage: [...(priorMetadata?.stepTokenUsage ?? []), ...stepTokenUsage],
                    modelName,
                    traceId,
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
    promptCacheStrategy: PromptCacheStrategy;
    providerOptions?: ProviderOptions;
    temperature?: number;
    selectedRepos: string[];
    disabledMcpServerIds?: string[];
    inputMessages: ModelMessage[];
    inputSources: Source[];
    onWriteSource: (source: Source) => void;
    onMcpServerDiscovered: (sanitizedName: string, faviconUrl: string) => void;
    onMcpServerFailed: (serverName: string) => void;
    traceId: string;
    chatId: string;
    prisma: PrismaClient;
    userId?: string;
    orgId?: number;
}

const createAgentStream = async ({
    model,
    promptCacheStrategy,
    providerOptions,
    temperature,
    inputMessages,
    inputSources,
    selectedRepos,
    disabledMcpServerIds,
    onWriteSource,
    onMcpServerDiscovered,
    onMcpServerFailed,
    traceId,
    chatId,
    prisma,
    userId,
    orgId,
}: AgentOptions) => {
    // Sort repos so the dynamic <selected_repositories> block is byte-stable
    // across a chat's requests (prompt caching).
    const sortedRepos = [...selectedRepos].sort((a, b) => a.localeCompare(b));

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

    let mcpToolSetsObj: McpToolsResult = { tools: {}, failedServers: [], serverFaviconUrls: {}, cleanup: async () => {} };
    if (userId && orgId && await hasEntitlement('ask') && disabledMcpServerIds !== undefined) {
        try {
            const allMcpClients = await getConnectedMcpClients(prisma, userId, orgId);
            const mcpClients = allMcpClients.filter((c) => !disabledMcpServerIds.includes(c.serverId));
            mcpToolSetsObj = await getMcpTools(mcpClients, {
                chatId,
                traceId,
                source: 'sourcebot-ask-agent',
            });

            for (const [sanitizedName, faviconUrl] of Object.entries(mcpToolSetsObj.serverFaviconUrls)) {
                onMcpServerDiscovered(sanitizedName, faviconUrl);
            }

            if (mcpClients.length > 0) {
                logger.info(`Connected to ${mcpClients.length} external MCP server(s): ${mcpClients.map(c => c.serverName).join(', ')}`);
            }
        } catch (error) {
            logger.error('Failed to connect external MCP servers:', error);
        }
    }

    for (const serverName of mcpToolSetsObj.failedServers) {
        onMcpServerFailed(serverName);
    }

    const mcpRegistry = buildMcpToolRegistry(mcpToolSetsObj.tools);
    const hasMcpTools = mcpRegistry.length > 0;

    // Phased-rollout lever for the static checkpoint. When disabled, only the
    // moving tail marker is emitted and behavior collapses to the prior
    // single-breakpoint scheme.
    const useStaticPrefix = env.SOURCEBOT_CHAT_PROMPT_CACHE_STATIC_PREFIX_ENABLED === 'true';
    const staticTtl = env.SOURCEBOT_CHAT_PROMPT_CACHE_STATIC_TTL;

    const toolRequestActivation = tool({
        description: dedent`
        Activate an MCP tool by name so it becomes callable on your next step.
        You MUST pass an exact tool name from the tool registry in the system prompt.
        Do NOT pass natural language descriptions or sentences.
        If you need multiple tools, call this once per tool.

        Examples:
          CORRECT: tool_to_activate_name="mcp_linear__save_comment"
          CORRECT: tool_to_activate_name="mcp_linear__create_attachment"
          INCORRECT: tool_to_activate_name="create a linear issue and update status"
          INCORRECT: tool_to_activate_name="find tools for commenting on issues"
        `,
        inputSchema: z.object({
            tool_to_activate_name: z.string().describe('Exact tool name from the registry, e.g. "mcp_linear__save_comment"'),
        }),
        execute: async ({ tool_to_activate_name }) => {
            const results = searchMcpTools(tool_to_activate_name, mcpRegistry);
            return {
                results: results.map(e => ({ name: e.name, description: e.description })),
            };
        },
    });

    const { staticPrompt, dynamicPrompt } = createPrompt({
        repos: sortedRepos,
        files: resolvedFileSources,
        mcpToolRegistry: mcpRegistry,
    });

    const builtinTools = createTools({ source: 'sourcebot-ask-agent', selectedRepos: sortedRepos });
    const builtinToolNames = Object.keys(builtinTools);
    const allTools: Record<string, Tool> = {
        ...builtinTools,
        ...(hasMcpTools ? { tool_request_activation: toolRequestActivation, ...mcpToolSetsObj.tools } : {}),
    };

    // Anthropic prompt caching uses two nested breakpoints over one cumulative
    // prefix (render order: tools -> system -> messages):
    //
    //   Static checkpoint: the static system block below caches tools + the
    //     static system instructions. This block is byte-identical across every
    //     chat and user, so it is a divergence-proof checkpoint a brand-new chat
    //     can read from instead of re-writing the large static prefix.
    //   Moving tail: a breakpoint on the last message of each step (applied in
    //     `prepareStep` below) caches tools + static + dynamic system + the full
    //     conversation so far. Because it advances to the new tail every step,
    //     the turn's growing delta (assistant tool calls and their outputs) is
    //     cached incrementally instead of reprocessed on each later step.
    //
    // The `anthropic` provider-options namespace is ignored by non-Anthropic
    // providers, and a no-op strategy emits no markers at all, so this is safe
    // for every provider. When the static prefix falls below the model's minimum
    // cacheable size the marker is a harmless no-op.
    //
    // Caveat: when MCP tools are lazily activated mid-run via prepareStep, the
    // tools section grows and invalidates both breakpoints for that step; the
    // cache re-warms on subsequent steps once the active tool set is stable.
    const staticMarker = useStaticPrefix
        ? promptCacheStrategy.cacheControl({ ttl: staticTtl })
        : undefined;
    const systemMessages: SystemModelMessage[] = [
        { role: 'system', content: staticPrompt, providerOptions: staticMarker },
    ];
    if (dynamicPrompt) {
        systemMessages.push({ role: 'system', content: dynamicPrompt });
    }

    // The moving-tail marker (see above), resolved once here. `prepareStep`
    // merges it onto the last message's existing providerOptions so sibling
    // namespaces (e.g. anthropic.thinking) survive; a no-op strategy leaves it
    // undefined and the messages untouched.
    const tailMarker = promptCacheStrategy.cacheControl();

    if (env.SOURCEBOT_CHAT_PROMPT_CACHE_BREAK_DETECTION_ENABLED === 'true') {
        detectPromptCacheBreak({
            chatId,
            staticPrompt,
            toolSignature: Object.entries(builtinTools)
                .map(([name, builtinTool]) => `${name}:${builtinTool.description ?? ''}`)
                .join('|'),
            model: typeof model === 'string' ? model : model.modelId,
            staticTtl,
        });
    }

    try {
        const stream = streamText({
            model,
            providerOptions,
            messages: inputMessages,
            system: systemMessages,
            tools: allTools,
            activeTools: [
                ...builtinToolNames,
                ...(hasMcpTools ? ['tool_request_activation'] : []),
            ],
            // `prepareStep` runs before every step (including the first). The SDK
            // rebuilds the step's messages each time as the original input plus
            // its own accumulated response messages. Re-applying the moving tail marker
            // to the new last message each step is safe and does not accumulate.
            prepareStep: (tailMarker || hasMcpTools) ? ({ steps, messages }) => {
                const stepMessages = (tailMarker && messages.length > 0)
                    ? messages.map((message, index) =>
                        index === messages.length - 1
                            ? { ...message, providerOptions: mergeProviderOptions(message.providerOptions, tailMarker) }
                            : message)
                    : undefined;

                if (!hasMcpTools) {
                    return stepMessages ? { messages: stepMessages } : {};
                }

                const activated = new Set<string>();
                for (const step of steps) {
                    for (const toolResult of step.toolResults) {
                        if (!toolResult || toolResult.toolName !== 'tool_request_activation') {
                            continue;
                        }
                        const output = toolResult.output as { results?: Array<{ name: string }> };
                        for (const { name } of output?.results ?? []) {
                            if (name in mcpToolSetsObj.tools) {
                                activated.add(name);
                            }
                        }
                    }
                }

                return {
                    ...(stepMessages ? { messages: stepMessages } : {}),
                    activeTools: [
                        ...builtinToolNames,
                        'tool_request_activation',
                        ...Array.from(activated),
                    ],
                };
            } : undefined,
            temperature: temperature ?? env.SOURCEBOT_CHAT_MODEL_TEMPERATURE,
            stopWhen: [
                stepCountIsGTE(env.SOURCEBOT_CHAT_MAX_STEP_COUNT),
            ],
            toolChoice: "auto",
            experimental_repairToolCall: async ({ toolCall, tools, error }) => {
                // Fix case mismatches (e.g. model outputs "Mcp_Linear__Save_Comment" instead of "mcp_linear__save_comment")
                if (NoSuchToolError.isInstance(error)) {
                    const lower = toolCall.toolName.toLowerCase();
                    if (lower !== toolCall.toolName && lower in tools) {
                        return { ...toolCall, toolName: lower };
                    }
                }

                // For anything we can't fix, return null.
                // The AI SDK will mark the call as invalid and pass the error
                // back to the model so it can retry with correct parameters.
                logger.warn(`Tool call repair failed for "${toolCall.toolName}": ${error.message}`);
                return null;
            },
            // Token usage collection deliberately does NOT happen here: the SDK
            // awaits this callback before starting the next step, so it must
            // stay cheap, and `toolResults` misses tool calls that never run
            // inside a step (approval-gated tools execute before the step loop)
            // as well as thrown tool errors (recorded as `tool-error` parts).
            // Both are instead derived post-stream in `createMessageStream`
            // from `steps` and `response.messages`.
            onStepFinish: ({ toolResults }) => {
                toolResults.forEach(({ output, dynamic }) => {
                    if (dynamic || isServiceError(output)) {
                        return;
                    }

                    output.sources?.forEach(onWriteSource);
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

        // Clean up MCP transport connections once the stream completes (success or failure).
        stream.response.then(
            () => mcpToolSetsObj.cleanup(),
            () => mcpToolSetsObj.cleanup()
        );
        return stream;
    } catch (error) {
        // If anything between MCP setup and stream return throws, ensure we
        // still close the MCP transport connections to avoid leaking them.
        await mcpToolSetsObj.cleanup();
        throw error;
    }
}


const createPrompt = ({
    files,
    repos,
    mcpToolRegistry,
}: {
    files?: {
        path: string;
        source: string;
        repo: string;
        language: string;
        revision: string;
    }[],
    repos: string[],
    mcpToolRegistry: McpToolRegistryEntry[],
}): { staticPrompt: string; dynamicPrompt: string } => {
    // Static prefix: byte-identical across every chat and user.
    // It interpolates only module-level constants. Keep it free of any
    // per-conversation data — repos, files, and MCP tools live in the dynamic
    // block below so their volatility never busts the shared static cache.
    const staticPrompt = dedent`
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
    `;

    // Dynamic block: per-conversation context (selected repos, mentioned files,
    // MCP tool registry).
    const dynamicSections: string[] = [];

    if (repos.length > 0) {
        dynamicSections.push(dedent`
        <selected_repositories>
        The user has explicitly selected the following repositories for analysis:
        ${repos.map(repo => `- ${repo}`).join('\n')}

        When calling tools that accept a \`repo\` parameter (e.g. \`read_file\`, \`list_commits\`, \`list_tree\`, \`get_diff\`, \`grep\`), use these repository names exactly as listed above, including the full host prefix (e.g. \`github.com/org/repo\`).

        When using \`grep\` to search across ALL selected repositories (e.g. "which repos have X?"), omit the \`repo\` parameter entirely — the tool will automatically search across all selected repositories in a single call. Do NOT call \`grep\` once per repository when a single broad search would suffice.
        </selected_repositories>
        `);
    }

    if (files && files.length > 0) {
        dynamicSections.push(dedent`
        <files>
        The user has mentioned the following files, which are automatically included for analysis.

        ${files.map(file => `<file path="${file.path}" repository="${file.repo}" language="${file.language}" revision="${file.revision}">
            ${addLineNumbers(file.source)}
            </file>`).join('\n\n')}
        </files>
        `);
    }

    if (mcpToolRegistry.length > 0) {
        dynamicSections.push(dedent`
        <mcp_tools>
        External MCP tools are available but must first be activated via \`tool_request_activation\`.

        **CRITICAL**: The list below is the complete and authoritative inventory of all tools available to you:
        ${mcpToolRegistry.map(e => `- ${e.name}: ${e.description}`).join('\n')}

        **How to use tool_request_activation**: Pass the exact tool name from the list above as the \`tool_to_activate_name\` parameter. Do NOT pass natural language descriptions or sentences. If you need multiple tools, call \`tool_request_activation\` once per tool.
        Example: to activate the comment tool, call \`tool_request_activation\` with tool_to_activate_name="mcp_linear__save_comment", NOT tool_to_activate_name="save a comment on an issue".
        </mcp_tools>
        `);
    }

    return { staticPrompt, dynamicPrompt: dynamicSections.join('\n\n') };
}

// If the agent exceeds the step count, then we will stop.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stepCountIsGTE = (stepCount: number): StopCondition<any> => {
    return ({ steps }) => steps.length >= stepCount;
}
