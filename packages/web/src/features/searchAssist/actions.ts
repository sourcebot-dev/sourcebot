'use server';

import { sew } from "@/actions";
import { _getAISDKLanguageModelAndOptions, _getConfiguredLanguageModelsFull } from "@/features/chat/actions";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError } from "@/lib/serviceError";
import { withOptionalAuthV2 } from "@/withAuthV2";
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
    withOptionalAuthV2(async () => {
        const models = await _getConfiguredLanguageModelsFull();

        if (models.length === 0) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: 'No language models are configured.',
            } satisfies ServiceError;
        }

        const { model } = await _getAISDKLanguageModelAndOptions(models[0]);

        const { object } = await generateObject({
            model,
            system: SYSTEM_PROMPT,
            prompt,
            schema: z.object({
                query: z.string().describe("The Sourcebot search query."),
            }),
        });

        return { query: object.query };
    })
);
