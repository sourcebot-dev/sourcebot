import { LanguageModelInfo } from "@/features/chat/types";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";

const formatLanguageModelName = (model: Pick<LanguageModelInfo, 'provider' | 'model'>) =>
    `${model.provider}/${model.model}`;

const formatConfiguredLanguageModelLabel = (model: Pick<LanguageModelInfo, 'provider' | 'model' | 'displayName'>) =>
    model.displayName ? `'${model.displayName}'` : formatLanguageModelName(model);

export const selectConfiguredLanguageModel = <T extends Pick<LanguageModelInfo, 'provider' | 'model' | 'displayName'>>(
    configuredModels: T[],
    requestedLanguageModel: Pick<LanguageModelInfo, 'provider' | 'model' | 'displayName'>
): (
    | { languageModelConfig: T; error?: never }
    | { languageModelConfig?: never; error: ServiceError }
) => {
    const candidateModels = configuredModels.filter(
        (model) => model.provider === requestedLanguageModel.provider && model.model === requestedLanguageModel.model
    );
    if (candidateModels.length === 0) {
        return {
            error: {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: `Language model '${formatLanguageModelName(requestedLanguageModel)}' is not configured.`,
            } satisfies ServiceError,
        };
    }

    if (requestedLanguageModel.displayName) {
        const matchingModel = candidateModels.find(
            (model) => model.displayName === requestedLanguageModel.displayName
        );
        if (!matchingModel) {
            const availableDisplayNames = candidateModels.map(formatConfiguredLanguageModelLabel).join(', ');
            return {
                error: {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: `Language model '${formatLanguageModelName(requestedLanguageModel)}' is configured, but not with displayName '${requestedLanguageModel.displayName}'. Available matches: ${availableDisplayNames}.`,
                } satisfies ServiceError,
            };
        }

        return { languageModelConfig: matchingModel };
    }

    if (candidateModels.length > 1) {
        const availableDisplayNames = candidateModels.map(formatConfiguredLanguageModelLabel).join(', ');
        return {
            error: {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: `Language model '${formatLanguageModelName(requestedLanguageModel)}' matches multiple configured models. Pass displayName to disambiguate. Available matches: ${availableDisplayNames}.`,
            } satisfies ServiceError,
        };
    }

    return { languageModelConfig: candidateModels[0] };
};
