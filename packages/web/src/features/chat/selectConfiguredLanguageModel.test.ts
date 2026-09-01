import { describe, expect, test } from "vitest";
import { selectConfiguredLanguageModel } from "./selectConfiguredLanguageModel";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";

describe("selectConfiguredLanguageModel", () => {
    const model1 = {
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        displayName: "Claude Sonnet 4.6",
    };

    const model2 = {
        provider: "anthropic",
        model: "claude-opus-4-7",
        displayName: "Claude Opus 4.7 (Fast)",
    };

    const model3 = {
        provider: "anthropic",
        model: "claude-opus-4-7",
        displayName: "Claude Opus 4.7 (Thinking)",
    };

    const model4 = {
        provider: "openai",
        model: "gpt-4o",
    };

    const configuredModels = [model1, model2, model3, model4];

    test("returns error when no models are configured", () => {
        const result = selectConfiguredLanguageModel([], {
            provider: "anthropic",
            model: "claude-sonnet-4-6",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
            expect(result.error.errorCode).toBe(ErrorCode.INVALID_REQUEST_BODY);
            expect(result.error.message).toContain("No language models are configured");
        }
    });

    test("defaults to first configured model when no requested model is provided", () => {
        const result = selectConfiguredLanguageModel(configuredModels);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.model).toEqual(model1);
        }
    });

    test("defaults to first configured model when empty object is provided", () => {
        const result = selectConfiguredLanguageModel(configuredModels, {});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.model).toEqual(model1);
        }
    });

    test("matches model uniquely by provider and model when displayName is omitted", () => {
        const result = selectConfiguredLanguageModel(configuredModels, {
            provider: "anthropic",
            model: "claude-sonnet-4-6",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.model).toEqual(model1);
        }
    });

    test("matches model uniquely when configured model has no displayName and request omits it", () => {
        const result = selectConfiguredLanguageModel(configuredModels, {
            provider: "openai",
            model: "gpt-4o",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.model).toEqual(model4);
        }
    });

    test("matches model strictly by exact provider, model, and displayName", () => {
        const result = selectConfiguredLanguageModel(configuredModels, {
            provider: "anthropic",
            model: "claude-opus-4-7",
            displayName: "Claude Opus 4.7 (Thinking)",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.model).toEqual(model3);
        }
    });

    test("returns 400 with disambiguation message when multiple models match provider/model and displayName is omitted", () => {
        const result = selectConfiguredLanguageModel(configuredModels, {
            provider: "anthropic",
            model: "claude-opus-4-7",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
            expect(result.error.errorCode).toBe(ErrorCode.INVALID_REQUEST_BODY);
            expect(result.error.message).toContain("Multiple configurations found for language model 'anthropic/claude-opus-4-7'");
            expect(result.error.message).toContain("'Claude Opus 4.7 (Fast)'");
            expect(result.error.message).toContain("'Claude Opus 4.7 (Thinking)'");
            expect(result.error.message).not.toContain("(default)");
        }
    });

    test("handles multiple models with identical provider/model when none have displayName", () => {
        const duplicateUnnamed = [
            { provider: "ollama", model: "llama3" },
            { provider: "ollama", model: "llama3" },
        ];

        const result = selectConfiguredLanguageModel(duplicateUnnamed, {
            provider: "ollama",
            model: "llama3",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
            expect(result.error.errorCode).toBe(ErrorCode.INVALID_REQUEST_BODY);
            expect(result.error.message).toContain("Please configure distinct displayNames in your configuration");
        }
    });

    test("handles mixed named and unnamed models sharing provider and model", () => {
        const mixed = [
            { provider: "anthropic", model: "claude-opus-4-7" },
            { provider: "anthropic", model: "claude-opus-4-7", displayName: "Thinking Mode" },
        ];

        const result = selectConfiguredLanguageModel(mixed, {
            provider: "anthropic",
            model: "claude-opus-4-7",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
            expect(result.error.errorCode).toBe(ErrorCode.INVALID_REQUEST_BODY);
            expect(result.error.message).toContain("Please specify a displayName from ['Thinking Mode'] or configure distinct displayNames in your configuration for unnamed models.");
        }
    });

    test("preserves empty-string displayName in disambiguation message", () => {
        const withEmptyString = [
            { provider: "openai", model: "gpt-4o", displayName: "" },
            { provider: "openai", model: "gpt-4o", displayName: "Named" },
        ];

        const result = selectConfiguredLanguageModel(withEmptyString, {
            provider: "openai",
            model: "gpt-4o",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
            expect(result.error.errorCode).toBe(ErrorCode.INVALID_REQUEST_BODY);
            expect(result.error.message).toContain("('', 'Named')");
        }
    });

    test("returns 400 when model is not configured", () => {
        const result = selectConfiguredLanguageModel(configuredModels, {
            provider: "google",
            model: "gemini-2.0-flash",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
            expect(result.error.errorCode).toBe(ErrorCode.INVALID_REQUEST_BODY);
            expect(result.error.message).toBe("Language model 'google/gemini-2.0-flash' is not configured.");
        }
    });

    test("returns 400 when provider/model matches but displayName does not match any config", () => {
        const result = selectConfiguredLanguageModel(configuredModels, {
            provider: "anthropic",
            model: "claude-sonnet-4-6",
            displayName: "Nonexistent Display Name",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
            expect(result.error.errorCode).toBe(ErrorCode.INVALID_REQUEST_BODY);
            expect(result.error.message).toBe("Language model 'anthropic/claude-sonnet-4-6' ('Nonexistent Display Name') is not configured.");
        }
    });

    test("matches when displayName is empty string if configured with empty string", () => {
        const modelsWithEmpty = [
            { provider: "openai", model: "gpt-4o", displayName: "" },
        ];

        const result = selectConfiguredLanguageModel(modelsWithEmpty, {
            provider: "openai",
            model: "gpt-4o",
            displayName: "",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.model.displayName).toBe("");
        }
    });
});
