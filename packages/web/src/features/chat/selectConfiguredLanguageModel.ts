import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError } from "@/lib/serviceError";

export type SelectConfiguredLanguageModelResult<T> =
    | { success: true; model: T }
    | { success: false; error: ServiceError };

type MatchableModel = {
    provider: string;
    model: string;
    displayName?: string;
};

/**
 * Selects a configured language model from a list of configured models
 * based on a requested language model specifier.
 *
 * - If no language model is requested, defaults to the first configured model.
 * - If `displayName` is provided in the request, matches strictly on `(provider, model, displayName)`.
 * - If `displayName` is omitted in the request:
 *   - If exactly one model matches `(provider, model)`, that model is selected.
 *   - If multiple models match `(provider, model)`, returns a 400 error requiring `displayName` disambiguation.
 *   - If no models match, returns a 400 error indicating the model is not configured.
 */
export const selectConfiguredLanguageModel = <T extends MatchableModel>(
    configuredModels: T[],
    requestedLanguageModel?: Partial<MatchableModel>
): SelectConfiguredLanguageModelResult<T> => {
    if (configuredModels.length === 0) {
        return {
            success: false,
            error: {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: "No language models are configured. Please configure at least one language model. See: https://docs.sourcebot.dev/docs/configuration/language-model-providers",
            },
        };
    }

    if (!requestedLanguageModel || (!requestedLanguageModel.provider && !requestedLanguageModel.model)) {
        return {
            success: true,
            model: configuredModels[0],
        };
    }

    const { provider, model, displayName } = requestedLanguageModel;

    // If displayName is explicitly provided, match on exact (provider, model, displayName)
    if (displayName) {
        const exactMatch = configuredModels.find((m) => {
            return m.provider === provider && m.model === model && m.displayName === displayName;
        });

        if (exactMatch) {
            return {
                success: true,
                model: exactMatch,
            };
        }

        return {
            success: false,
            error: {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: `Language model '${provider}/${model}' ('${displayName}') is not configured.`,
            },
        };
    }

    // If displayName is omitted, find all configs matching (provider, model)
    const matchingModels = configuredModels.filter((m) => {
        return m.provider === provider && m.model === model;
    });

    if (matchingModels.length === 1) {
        return {
            success: true,
            model: matchingModels[0],
        };
    }

    if (matchingModels.length > 1) {
        const displayNames = matchingModels
            .map((m) => m.displayName || "(default)")
            .map((name) => `'${name}'`)
            .join(', ');

        return {
            success: false,
            error: {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: `Multiple configurations found for language model '${provider}/${model}'. Please specify a displayName (${displayNames}) to disambiguate.`,
            },
        };
    }

    return {
        success: false,
        error: {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: `Language model '${provider}/${model}' is not configured.`,
        },
    };
};
