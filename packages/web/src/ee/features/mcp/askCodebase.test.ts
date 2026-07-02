import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";
import { describe, expect, it } from "vitest";
import { selectConfiguredLanguageModel } from "./askCodebase";

type ConfiguredLanguageModel = Parameters<typeof selectConfiguredLanguageModel>[0][number];

const createConfiguredModel = (overrides: Partial<{
    provider: string;
    model: string;
    displayName?: string;
}> = {}) => ({
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    displayName: 'Claude Opus 4.7',
    ...overrides,
}) as ConfiguredLanguageModel;

describe("selectConfiguredLanguageModel", () => {
    it("matches a configured model by provider and model when displayName is omitted", () => {
        const configuredModel = createConfiguredModel();

        const result = selectConfiguredLanguageModel(
            [configuredModel],
            { provider: configuredModel.provider, model: configuredModel.model }
        );

        expect(result).toEqual({ languageModelConfig: configuredModel });
    });

    it("uses displayName to disambiguate duplicate provider/model entries", () => {
        const firstModel = createConfiguredModel({ displayName: 'Claude Opus 4.7 (slow)' });
        const secondModel = createConfiguredModel({ displayName: 'Claude Opus 4.7 (fast)' });

        const result = selectConfiguredLanguageModel(
            [firstModel, secondModel],
            {
                provider: firstModel.provider,
                model: firstModel.model,
                displayName: secondModel.displayName,
            }
        );

        expect(result).toEqual({ languageModelConfig: secondModel });
    });

    it("returns a disambiguation error when multiple configured models match", () => {
        const firstModel = createConfiguredModel({ displayName: 'Claude Opus 4.7 (slow)' });
        const secondModel = createConfiguredModel({ displayName: 'Claude Opus 4.7 (fast)' });

        const result = selectConfiguredLanguageModel(
            [firstModel, secondModel],
            { provider: firstModel.provider, model: firstModel.model }
        );

        expect(result).toEqual({
            error: {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: "Language model 'anthropic/claude-opus-4-7' matches multiple configured models. Pass displayName to disambiguate. Available matches: 'Claude Opus 4.7 (slow)', 'Claude Opus 4.7 (fast)'.",
            },
        });
    });

    it("returns an error when displayName does not match any configured model", () => {
        const configuredModel = createConfiguredModel();

        const result = selectConfiguredLanguageModel(
            [configuredModel],
            {
                provider: configuredModel.provider,
                model: configuredModel.model,
                displayName: 'Claude Sonnet 4.6',
            }
        );

        expect(result).toEqual({
            error: {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: "Language model 'anthropic/claude-opus-4-7' is configured, but not with displayName 'Claude Sonnet 4.6'. Available matches: 'Claude Opus 4.7'.",
            },
        });
    });
});
