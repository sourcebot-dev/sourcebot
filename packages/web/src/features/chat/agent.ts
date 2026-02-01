import { getFileSource } from '@/features/git';
import { isServiceError } from "@/lib/utils";
import { ProviderOptions } from "@ai-sdk/provider-utils";
import { createLogger, env } from "@sourcebot/shared";
import { env as clientEnv } from "@sourcebot/shared/client";
import { LanguageModel, ModelMessage, StopCondition, streamText } from "ai";
import { ANSWER_TAG, FILE_REFERENCE_PREFIX, toolNames } from "./constants";
import { createCodeSearchTool, findSymbolDefinitionsTool, findSymbolReferencesTool, listReposTool, readFilesTool } from "./tools";
import { Source } from "./types";
import { addLineNumbers, fileReferenceToString } from "./utils";
import _dedent from "dedent";

const dedent = _dedent.withOptions({ alignValues: true });

const logger = createLogger('chat-agent');

interface AgentOptions {
    model: LanguageModel;
    providerOptions?: ProviderOptions;
    selectedRepos: string[];
    inputMessages: ModelMessage[];
    inputSources: Source[];
    onWriteSource: (source: Source) => void;
    traceId: string;
}

export const createAgentStream = async ({
    model,
    providerOptions,
    inputMessages,
    inputSources,
    selectedRepos,
    onWriteSource,
    traceId,
}: AgentOptions) => {
    // For every file source, resolve the source code so that we can include it in the system prompt.
    const fileSources = inputSources.filter((source) => source.type === 'file');
    const resolvedFileSources = (
        await Promise.all(fileSources.map(async (source) => {
            const fileSource = await getFileSource({
                path: source.path,
                repo: source.repo,
                ref: source.revision,
            });

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
        tools: {
            [toolNames.searchCode]: createCodeSearchTool(selectedRepos),
            [toolNames.readFiles]: readFilesTool,
            [toolNames.findSymbolReferences]: findSymbolReferencesTool,
            [toolNames.findSymbolDefinitions]: findSymbolDefinitionsTool,
            [toolNames.listRepos]: listReposTool,
        },
        temperature: env.SOURCEBOT_CHAT_MODEL_TEMPERATURE,
        stopWhen: [
            stepCountIsGTE(env.SOURCEBOT_CHAT_MAX_STEP_COUNT),
        ],
        toolChoice: "auto",
        onStepFinish: ({ toolResults }) => {
            toolResults.forEach(({ toolName, output, dynamic }) => {
                if (dynamic || isServiceError(output)) {
                    return;
                }

                if (toolName === toolNames.readFiles) {
                    output.forEach((file) => {
                        onWriteSource({
                            type: 'file',
                            language: file.language,
                            repo: file.repository,
                            path: file.path,
                            revision: file.revision,
                            name: file.path.split('/').pop() ?? file.path,
                        });
                    });
                } else if (toolName === toolNames.searchCode) {
                    output.files.forEach((file) => {
                        onWriteSource({
                            type: 'file',
                            language: file.language,
                            repo: file.repository,
                            path: file.fileName,
                            revision: file.revision,
                            name: file.fileName.split('/').pop() ?? file.fileName,
                        });
                    });
                } else if (toolName === toolNames.findSymbolDefinitions || toolName === toolNames.findSymbolReferences) {
                    output.forEach((file) => {
                        onWriteSource({
                            type: 'file',
                            language: file.language,
                            repo: file.repository,
                            path: file.fileName,
                            revision: file.revision,
                            name: file.fileName.split('/').pop() ?? file.fileName,
                        });
                    });
                }
            });
        },
        experimental_telemetry: {
            isEnabled: clientEnv.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT !== undefined,
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
        </selected_repositories>
    ` : ''}

    ${files ? dedent`
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
