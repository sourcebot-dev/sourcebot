import 'server-only';

import { createPostHogClient, tryGetPostHogDistinctId } from "@/lib/posthog";
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI, GoogleLanguageModelOptions } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI, OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { LanguageModelV3 as AISDKLanguageModelV3 } from "@ai-sdk/provider";
import { createXai } from '@ai-sdk/xai';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { withTracing } from "@posthog/ai";
import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { Token } from "@sourcebot/schemas/v3/shared.type";
import { env, getTokenFromConfig } from '@sourcebot/shared';
import { extractReasoningMiddleware, JSONValue, wrapLanguageModel } from "ai";

// @note: This module resolves a configured language model into an AI SDK
// provider object. It is intentionally FSL (open source) provider plumbing —
// it contains no Ask-specific logic and is shared by multiple features (the
// Ask chat agent, the MCP `ask_codebase` tool, AI search-assist, and the
// review agent). The re-licensed Ask logic (prompts, tools, threads, chat
// name generation) lives in `@/ee/features/chat`.

export const getAISDKLanguageModelAndOptions = async (config: LanguageModel): Promise<{
    model: AISDKLanguageModelV3,
    providerOptions?: Record<string, Record<string, JSONValue>>,
    temperature?: number,
}> => {
    const { provider, model: modelId } = config;

    const { model: _model, providerOptions } = await (async (): Promise<{
        model: AISDKLanguageModelV3,
        providerOptions?: Record<string, Record<string, JSONValue>>,
    }> => {
        switch (provider) {
            case 'amazon-bedrock': {
                const aws = createAmazonBedrock({
                    baseURL: config.baseUrl,
                    region: config.region ?? env.AWS_REGION,
                    accessKeyId: config.accessKeyId
                        ? await getTokenFromConfig(config.accessKeyId)
                        : env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: config.accessKeySecret
                        ? await getTokenFromConfig(config.accessKeySecret)
                        : env.AWS_SECRET_ACCESS_KEY,
                    sessionToken: config.sessionToken
                        ? await getTokenFromConfig(config.sessionToken)
                        : env.AWS_SESSION_TOKEN,
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                    // Fallback to the default Node.js credential provider chain if no credentials are provided.
                    // See: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-credential-providers/#fromnodeproviderchain
                    credentialProvider: !config.accessKeyId && !config.accessKeySecret && !config.sessionToken
                        ? fromNodeProviderChain()
                        : undefined,
                });

                return {
                    model: aws(modelId),
                };
            }
            case 'anthropic': {
                const anthropic = createAnthropic({
                    baseURL: config.baseUrl,
                    apiKey: config.token
                        ? await getTokenFromConfig(config.token)
                        : env.ANTHROPIC_API_KEY,
                    authToken: config.authToken
                        ? await getTokenFromConfig(config.authToken)
                        : env.ANTHROPIC_AUTH_TOKEN,
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                });

                const isAdaptiveThinkingSupported =
                    modelId.startsWith('claude-opus-4-7') ||
                    modelId.startsWith('claude-opus-4-8');

                return {
                    model: anthropic(modelId),
                    providerOptions: {
                        anthropic: {
                            thinking: isAdaptiveThinkingSupported ? {
                                type: "adaptive",
                                display: "summarized"
                            } : {
                                type: "enabled",
                                budgetTokens: env.ANTHROPIC_THINKING_BUDGET_TOKENS,
                            }
                        } satisfies AnthropicProviderOptions,
                    },
                };
            }
            case 'azure': {
                const azure = createAzure({
                    baseURL: config.baseUrl,
                    apiKey: config.token ? (await getTokenFromConfig(config.token)) : env.AZURE_API_KEY,
                    apiVersion: config.apiVersion,
                    resourceName: config.resourceName ?? env.AZURE_RESOURCE_NAME,
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                });

                const reasoningSummary = config.reasoningSummary ?? 'auto';
                return {
                    model: azure(modelId),
                    providerOptions: {
                        openai: {
                            reasoningEffort: config.reasoningEffort ?? 'medium',
                            ...(reasoningSummary !== 'none' && { reasoningSummary }),
                        } satisfies OpenAIResponsesProviderOptions,
                    }
                };
            }
            case 'deepseek': {
                const deepseek = createDeepSeek({
                    baseURL: config.baseUrl,
                    apiKey: config.token ? (await getTokenFromConfig(config.token)) : env.DEEPSEEK_API_KEY,
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                });

                return {
                    model: deepseek(modelId),
                };
            }
            case 'google-generative-ai': {
                const google = createGoogleGenerativeAI({
                    baseURL: config.baseUrl,
                    apiKey: config.token
                        ? await getTokenFromConfig(config.token)
                        : env.GOOGLE_GENERATIVE_AI_API_KEY,
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                });

                return {
                    model: google(modelId),
                    providerOptions: {
                        google: {
                            thinkingConfig: {
                                includeThoughts: true,
                                thinkingBudget: config.thinkingBudget,
                                thinkingLevel: config.thinkingLevel
                            }
                        } satisfies GoogleLanguageModelOptions
                    }
                };
            }
            case 'google-vertex': {
                const vertex = createVertex({
                    project: config.project ?? env.GOOGLE_VERTEX_PROJECT,
                    location: config.region ?? env.GOOGLE_VERTEX_REGION,
                    ...(config.credentials ? {
                        googleAuthOptions: {
                            keyFilename: await getTokenFromConfig(config.credentials),
                        }
                    } : {}),
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                });

                return {
                    model: vertex(modelId),
                    providerOptions: {
                        vertex: {
                            thinkingConfig: {
                                includeThoughts: true,
                                thinkingBudget:
                                    config.thinkingBudget ??
                                    env.GOOGLE_VERTEX_THINKING_BUDGET_TOKENS,
                                thinkingLevel: config.thinkingLevel,
                            }
                        } satisfies GoogleLanguageModelOptions
                    },
                };
            }
            case 'google-vertex-anthropic': {
                const vertexAnthropic = createVertexAnthropic({
                    project: config.project ?? env.GOOGLE_VERTEX_PROJECT,
                    location: config.region ?? env.GOOGLE_VERTEX_REGION,
                    ...(config.credentials ? {
                        googleAuthOptions: {
                            keyFilename: await getTokenFromConfig(config.credentials),
                        }
                    } : {}),
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                });

                return {
                    model: vertexAnthropic(modelId),
                };
            }
            case 'mistral': {
                const mistral = createMistral({
                    baseURL: config.baseUrl,
                    apiKey: config.token
                        ? await getTokenFromConfig(config.token)
                        : env.MISTRAL_API_KEY,
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                });

                return {
                    model: mistral(modelId),
                };
            }
            case 'openai': {
                const openai = createOpenAI({
                    baseURL: config.baseUrl,
                    apiKey: config.token
                        ? await getTokenFromConfig(config.token)
                        : env.OPENAI_API_KEY,
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                });

                const reasoningSummary = config.reasoningSummary ?? 'auto';
                return {
                    model: openai(modelId),
                    providerOptions: {
                        openai: {
                            reasoningEffort: config.reasoningEffort ?? 'medium',
                            ...(reasoningSummary !== 'none' && { reasoningSummary }),
                        } satisfies OpenAIResponsesProviderOptions,
                    },
                };
            }
            case 'openai-compatible': {
                const openai = createOpenAICompatible({
                    baseURL: config.baseUrl,
                    name: config.displayName ?? modelId,
                    apiKey: config.token
                        ? await getTokenFromConfig(config.token)
                        : undefined,
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                    queryParams: config.queryParams
                        ? await extractLanguageModelKeyValuePairs(config.queryParams)
                        : undefined,
                });

                const model = wrapLanguageModel({
                    model: openai.chatModel(modelId),
                    middleware: [
                        extractReasoningMiddleware({
                            tagName: config.reasoningTag ?? 'think',
                        }),
                    ]
                });

                return {
                    model,
                }
            }
            case 'openrouter': {
                const openrouter = createOpenRouter({
                    baseURL: config.baseUrl,
                    apiKey: config.token
                        ? await getTokenFromConfig(config.token)
                        : env.OPENROUTER_API_KEY,
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                });

                return {
                    model: openrouter(modelId),
                };
            }
            case 'xai': {
                const xai = createXai({
                    baseURL: config.baseUrl,
                    apiKey: config.token
                        ? await getTokenFromConfig(config.token)
                        : env.XAI_API_KEY,
                    headers: config.headers
                        ? await extractLanguageModelKeyValuePairs(config.headers)
                        : undefined,
                });

                return {
                    model: xai(modelId),
                };
            }
        }
    })();

    const posthog = await createPostHogClient();
    const distinctId = await tryGetPostHogDistinctId();

    // Only enable posthog LLM analytics for the ask GH experiment.
    const model = env.EXPERIMENT_ASK_GH_ENABLED === 'true' ?
        withTracing(_model, posthog, {
            posthogDistinctId: distinctId,
        }) :
        _model;

    return {
        model,
        providerOptions,
        temperature: config.temperature,
    };
}

const extractLanguageModelKeyValuePairs = async (
    pairs: {
        [k: string]: string | Token;
    }
): Promise<Record<string, string>> => {
    const resolvedPairs: Record<string, string> = {};

    if (!pairs) {
        return resolvedPairs;
    }

    for (const [key, val] of Object.entries(pairs)) {
        if (typeof val === "string") {
            resolvedPairs[key] = val;
            continue;
        }

        const value = await getTokenFromConfig(val);
        resolvedPairs[key] = value;
    }

    return resolvedPairs;
};
