'use server';

import { sew } from "@/middleware/sew";
import { getConfiguredLanguageModels } from "../chat/utils.server";
import { getAISDKLanguageModelAndOptions } from "@/features/chat/llm.server";
import { resolveInferenceRetryConfig, toInferenceServiceError } from "@/features/chat/inferenceRetry.server";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError, ServiceErrorException } from "@/lib/serviceError";
import { withOptionalAuth } from "@/middleware/withAuth";
import { SEARCH_SYNTAX_DESCRIPTION } from "@sourcebot/query-language";
import { generateObject } from "ai";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";

const SYSTEM_PROMPT = `You are a search query translator for Sourcebot, a code search engine.

Your job is to convert a natural language description into a valid Sourcebot search query.

${SEARCH_SYNTAX_DESCRIPTION}

## Instructions

- Output ONLY the search query string. Do not include any explanation, markdown formatting, code fences, or surrounding text.
- Use the most specific filters that match the user's intent.
- Use regex values (bare word with regex syntax) when the user implies patterns, ranges, or variations.
- Keep the query as simple as possible while accurately capturing the intent.
`;

export const translateSearchQuery = async ({ prompt }: { prompt: string }) => sew(() =>
    withOptionalAuth(async () => {
        const models = await getConfiguredLanguageModels();

        if (models.length === 0) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: 'No language models are configured.',
            } satisfies ServiceError;
        }

        const { model } = await getAISDKLanguageModelAndOptions(models[0]);

        try {
            const { object } = await generateObject({
                model,
                system: SYSTEM_PROMPT,
                prompt,
                schema: z.object({
                    query: z.string().describe("The Sourcebot search query."),
                }),
                maxRetries: resolveInferenceRetryConfig(models[0]).maxRetries,
            });

            return { query: object.query };
        } catch (error) {
            // Surface the provider's details instead of the generic
            // `sew` fallback so translation failures are debuggable.
            throw new ServiceErrorException(toInferenceServiceError(error, models[0]));
        }
    })
);
