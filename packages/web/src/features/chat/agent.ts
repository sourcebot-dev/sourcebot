import { env } from "@/env.mjs";
import { getFileSource } from "@/features/search/fileSourceApi";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { ProviderOptions } from "@ai-sdk/provider-utils";
import { createLogger } from "@sourcebot/logger";
import { LanguageModel, ModelMessage, StopCondition, streamText } from "ai";
import { ANSWER_TAG, FILE_REFERENCE_PREFIX, toolNames } from "./constants";
import { createCodeSearchTool, findSymbolDefinitionsTool, findSymbolReferencesTool, readFilesTool } from "./tools";
import { FileSource, Source } from "./types";
import { addLineNumbers, fileReferenceToString } from "./utils";

const logger = createLogger('chat-agent');

interface AgentOptions {
    model: LanguageModel;
    providerOptions?: ProviderOptions;
    headers?: Record<string, string>;
    selectedRepos: string[];
    inputMessages: ModelMessage[];
    inputSources: Source[];
    onWriteSource: (source: Source) => void;
    traceId: string;
}

// If the agent exceeds the step count, then we will stop.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stepCountIsGTE = (stepCount: number): StopCondition<any> => {
    return ({ steps }) => steps.length >= stepCount;
}

export const createAgentStream = async ({
    model,
    providerOptions,
    headers,
    inputMessages,
    inputSources,
    selectedRepos,
    onWriteSource,
    traceId,
}: AgentOptions) => {
    const baseSystemPrompt = createBaseSystemPrompt({
        selectedRepos,
    });

    const stream = streamText({
        model,
        providerOptions,
        headers,
        system: baseSystemPrompt,
        messages: inputMessages,
        tools: {
            [toolNames.searchCode]: createCodeSearchTool(selectedRepos),
            [toolNames.readFiles]: readFilesTool,
            [toolNames.findSymbolReferences]: findSymbolReferencesTool,
            [toolNames.findSymbolDefinitions]: findSymbolDefinitionsTool,
        },
        prepareStep: async ({ stepNumber }) => {
            // The first step attaches any mentioned sources to the system prompt.
            if (stepNumber === 0 && inputSources.length > 0) {
                const fileSources = inputSources.filter((source) => source.type === 'file');

                const resolvedFileSources = (
                    await Promise.all(fileSources.map(resolveFileSource)))
                        .filter((source) => source !== undefined)

                const fileSourcesSystemPrompt = await createFileSourcesSystemPrompt({
                    files: resolvedFileSources
                });

                return {
                    system: `${baseSystemPrompt}\n\n${fileSourcesSystemPrompt}`
                }
            }

            if (stepNumber === env.SOURCEBOT_CHAT_MAX_STEP_COUNT - 1) {
                return {
                    system: `**CRITICAL**: You have reached the maximum number of steps!! YOU MUST PROVIDE YOUR FINAL ANSWER NOW. DO NOT KEEP RESEARCHING.\n\n${answerInstructions}`,
                    activeTools: [],
                }
            }

            return undefined;
        },
        temperature: env.SOURCEBOT_CHAT_MODEL_TEMPERATURE,
        stopWhen: [
            stepCountIsGTE(env.SOURCEBOT_CHAT_MAX_STEP_COUNT),
        ],
        toolChoice: "auto", // Let the model decide when to use tools
        onStepFinish: ({ toolResults }) => {
            // This takes care of extracting any sources that the LLM has seen as part of
            // the tool calls it made.
            toolResults.forEach(({ output, toolName }) => {
                if (isServiceError(output)) {
                    // is there something we want to do here?
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
                        })
                    })
                }
                else if (toolName === toolNames.searchCode) {
                    output.files.forEach((file) => {
                        onWriteSource({
                            type: 'file',
                            language: file.language,
                            repo: file.repository,
                            path: file.fileName,
                            revision: file.revision,
                            name: file.fileName.split('/').pop() ?? file.fileName,
                        })
                    })
                }
                else if (toolName === toolNames.findSymbolDefinitions || toolName === toolNames.findSymbolReferences) {
                    output.forEach((file) => {
                        onWriteSource({
                            type: 'file',
                            language: file.language,
                            repo: file.repository,
                            path: file.fileName,
                            revision: file.revision,
                            name: file.fileName.split('/').pop() ?? file.fileName,
                        })
                    })
                }
            })
        },
        // Only enable langfuse traces in cloud environments.
        experimental_telemetry: {
            isEnabled: env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT !== undefined,
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

interface BaseSystemPromptOptions {
    selectedRepos: string[];
}

export const createBaseSystemPrompt = ({
    selectedRepos,
}: BaseSystemPromptOptions) => {
    return `
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

<available_repositories>
The user has selected the following repositories for analysis:
${selectedRepos.map(repo => `- ${repo}`).join('\n')}
</available_repositories>

<research_phase_instructions>
During the research phase, you have these tools available:
- \`${toolNames.searchCode}\`: Search for code patterns, functions, or text across repositories
- \`${toolNames.readFiles}\`: Read the contents of specific files
- \`${toolNames.findSymbolReferences}\`: Find where symbols are referenced
- \`${toolNames.findSymbolDefinitions}\`: Find where symbols are defined

Use these tools to gather comprehensive context before answering. Always explain why you're using each tool.
</research_phase_instructions>

${answerInstructions}
`;
}

const answerInstructions = `
<answer_instructions>
When you have sufficient context, output your answer as a structured markdown response.

**Required Response Format:**
- **CRITICAL**: You MUST always prefix your answer with a \`${ANSWER_TAG}\` tag at the very top of your response
- **CRITICAL**: You MUST provide your complete response in markdown format with embedded code references
- **CODE REFERENCE REQUIREMENT**: Whenever you mention, discuss, or refer to ANY specific part of the code (files, functions, variables, methods, classes, imports, etc.), you MUST immediately follow with a code reference using the format \`${fileReferenceToString({ fileName: 'filename'})}\` or \`${fileReferenceToString({ fileName: 'filename', range: { startLine: 1, endLine: 10 } })}\` (where the numbers are the start and end line numbers of the code snippet). This includes:
  - Files (e.g., "The \`auth.ts\` file" → must include \`${fileReferenceToString({ fileName: 'auth.ts' })}\`)
  - Function names (e.g., "The \`getRepos()\` function" → must include \`${fileReferenceToString({ fileName: 'auth.ts', range: { startLine: 15, endLine: 20 } })}\`)
  - Variable names (e.g., "The \`suggestionQuery\` variable" → must include \`${fileReferenceToString({ fileName: 'search.ts', range: { startLine: 42, endLine: 42 } })}\`)
  - Code patterns (e.g., "using \`file:\${suggestionQuery}\` pattern" → must include \`${fileReferenceToString({ fileName: 'search.ts', range: { startLine: 10, endLine: 15 } })}\`)
  - Any code snippet or line you're explaining
  - Class names, method calls, imports, etc.
- Be clear and very concise. Use bullet points where appropriate
- Do NOT explain code without providing the exact location reference. Every code mention requires a corresponding \`${FILE_REFERENCE_PREFIX}\` reference
- If you cannot provide a code reference for something you're discussing, do not mention that specific code element
- Always prefer to use \`${FILE_REFERENCE_PREFIX}\` over \`\`\`code\`\`\` blocks.

**Example answer structure:**
\`\`\`markdown
${ANSWER_TAG}
Authentication in Sourcebot is built on NextAuth.js with a session-based approach using JWT tokens and Prisma as the database adapter ${fileReferenceToString({ fileName: 'auth.ts', range: { startLine: 135, endLine: 140 } })}. The system supports multiple authentication providers and implements organization-based authorization with role-defined permissions.
\`\`\`

</answer_instructions>
`;

interface FileSourcesSystemPromptOptions {
    files: {
        path: string;
        source: string;
        repo: string;
        language: string;
        revision: string;
    }[];
}

const createFileSourcesSystemPrompt = async ({ files }: FileSourcesSystemPromptOptions) => {
    return `
The user has mentioned the following files, which are automatically included for analysis.

${files.map(file => `<file path="${file.path}" repository="${file.repo}" language="${file.language}" revision="${file.revision}">
${addLineNumbers(file.source)}
</file>`).join('\n\n')}
    `.trim();
}

const resolveFileSource = async ({ path, repo, revision }: FileSource) => {
    const fileSource = await getFileSource({
        fileName: path,
        repository: repo,
        branch: revision,
        // @todo: handle multi-tenancy.
    }, SINGLE_TENANT_ORG_DOMAIN);

    if (isServiceError(fileSource)) {
        // @todo: handle this
        logger.error("Error fetching file source:", fileSource)
        return undefined;
    }

    return {
        path,
        source: fileSource.source,
        repo,
        language: fileSource.language,
        revision,
    }
}