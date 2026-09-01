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

    if (displayName !== undefined) {
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
        const hasUnnamed = matchingModels.some((m) => m.displayName === undefined);
        const namedConfigs = matchingModels
            .map((m) => m.displayName)
            .filter((name): name is string => typeof name === "string");

        let hint: string;
        if (hasUnnamed) {
            hint = namedConfigs.length > 0
                ? `Please specify a displayName from [${namedConfigs.map((n) => `'${n}'`).join(', ')}] or configure distinct displayNames in your configuration for unnamed models.`
                : `Please configure distinct displayNames in your configuration to disambiguate.`;
        } else {
            hint = `Please specify a displayName (${namedConfigs.map((n) => `'${n}'`).join(', ')}) to disambiguate.`;
        }

        return {
            success: false,
            error: {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: `Multiple configurations found for language model '${provider}/${model}'. ${hint}`,
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
