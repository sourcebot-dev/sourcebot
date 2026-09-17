import 'server-only';

import { logger } from "@/features/chat/logger";
import { getLanguageModelKey } from "@/features/chat/utils";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError, ServiceErrorException } from "@/lib/serviceError";
import { LanguageModel } from "@sourcebot/schemas/v3/languageModel.type";
import { APICallError } from "ai";
import { StatusCodes } from "http-status-codes";

// @note: This module is the single place where inference (LLM provider)
// failures are interpreted, retried, and escalated. Both the interactive Ask
// chat path and the programmatic `askCodebase` path (MCP `ask_codebase` tool
// and `/api/chat/blocking`) share it so error reporting and resilience behave
// identically everywhere.
//
// Two layers of defense exist:
// 1. Retries (same model): transient failures (network errors, 408/429/5xx)
//    are retried with exponential backoff, configured per model via the
//    `retry` field in `config.json`.
// 2. Fallbacks (other models): when a model keeps failing, the ordered
//    `fallbackModels` list on that model is tried in order. Fallbacks are
//    only attempted on the blocking path (`askCodebase`), since an
//    interactive stream cannot switch models mid-response.

export const DEFAULT_INFERENCE_MAX_RETRIES = 3;
export const DEFAULT_INFERENCE_INITIAL_BACKOFF_MS = 500;
export const DEFAULT_INFERENCE_MAX_BACKOFF_MS = 8000;
const MAX_INFERENCE_MAX_RETRIES = 10;
const MAX_INFERENCE_BACKOFF_MS = 120000;
export const MAX_INFERENCE_FALLBACK_MODELS = 5;
// Provider error payloads can be large; keep only a prefix for observability.
const MAX_RESPONSE_BODY_SNIPPET_CHARS = 500;

export type InferenceRetryConfig = {
    maxRetries: number;
    initialBackoffMs: number;
    maxBackoffMs: number;
};

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    const rounded = Math.floor(value);
    if (rounded < min) {
        return min;
    }

    if (rounded > max) {
        return max;
    }

    return rounded;
};

/**
 * Resolves the effective retry policy for a model, falling back to the
 * defaults when the model configures no (or a partial) `retry` policy.
 */
export const resolveInferenceRetryConfig = (model: LanguageModel): InferenceRetryConfig => {
    const retry = model.retry ?? {};
    return {
        maxRetries: clampInt(retry.maxRetries, DEFAULT_INFERENCE_MAX_RETRIES, 0, MAX_INFERENCE_MAX_RETRIES),
        initialBackoffMs: clampInt(retry.initialBackoffMs, DEFAULT_INFERENCE_INITIAL_BACKOFF_MS, 0, MAX_INFERENCE_BACKOFF_MS),
        maxBackoffMs: clampInt(retry.maxBackoffMs, DEFAULT_INFERENCE_MAX_BACKOFF_MS, 0, MAX_INFERENCE_BACKOFF_MS),
    };
};

export const computeRetryDelayMs = (config: InferenceRetryConfig, failedAttemptIndex: number): number => {
    return Math.min(
        config.initialBackoffMs * Math.pow(2, failedAttemptIndex),
        config.maxBackoffMs,
    );
};

/**
 * Short human-readable model label used in logs and error messages.
 */
export const describeLanguageModel = (model: Pick<LanguageModel, 'provider' | 'model'>): string => {
    return `${model.provider}/${model.model}`;
};

type ApiErrorDetails = {
    statusCode?: number;
    responseBody?: unknown;
    url?: string;
    isRetryable?: boolean;
};

/**
 * Best-effort extraction of the provider-facing fields from an inference
 * error. Prefers the AI SDK's `APICallError` shape but duck-types the same
 * fields so errors from wrapped providers are still surfaced.
 */
export const extractApiErrorDetails = (error: unknown): ApiErrorDetails => {
    if (error === null || typeof error !== 'object') {
        return {};
    }

    if (APICallError.isInstance(error)) {
        return {
            statusCode: typeof error.statusCode === 'number' ? error.statusCode : undefined,
            responseBody: error.responseBody,
            url: typeof error.url === 'string' ? error.url : undefined,
            isRetryable: error.isRetryable,
        };
    }

    const record = error as Record<string, unknown>;
    const details: ApiErrorDetails = {};
    if (typeof record['statusCode'] === 'number') {
        details.statusCode = record['statusCode'];
    } else if (typeof record['status'] === 'number') {
        details.statusCode = record['status'];
    }

    if (typeof record['responseBody'] === 'string' || (typeof record['responseBody'] === 'object' && record['responseBody'] !== null)) {
        details.responseBody = record['responseBody'];
    }

    if (typeof record['url'] === 'string') {
        details.url = record['url'];
    }

    if (typeof record['isRetryable'] === 'boolean') {
        details.isRetryable = record['isRetryable'];
    }

    return details;
};

const NETWORK_ERROR_CODES = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ENOTFOUND',
    'EPIPE',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
]);

const NETWORK_ERROR_MESSAGE_HINTS = [
    'fetch failed',
    'network error',
    'terminated',
    'socket hang up',
];

/**
 * Walks the `cause` chain looking for a network-level failure. The AI SDK
 * does not always mark body-read network errors retryable, so this covers
 * transient transport failures explicitly.
 */
const hasNetworkErrorCause = (error: unknown): boolean => {
    let current: unknown = error;
    // Bound the walk: cause chains are short, but never trust their shape.
    for (let depth = 0; depth < 5; depth++) {
        if (current === null || (typeof current !== 'object' && typeof current !== 'string')) {
            return false;
        }

        if (typeof current === 'string') {
            const text = current;
            return NETWORK_ERROR_MESSAGE_HINTS.some((hint) => text.toLowerCase().includes(hint));
        }

        const record = current as Record<string, unknown>;
        const code = record['code'];
        if (typeof code === 'string' && NETWORK_ERROR_CODES.has(code)) {
            return true;
        }

        const message = record['message'];
        if (typeof message === 'string') {
            const text = message;
            if (NETWORK_ERROR_MESSAGE_HINTS.some((hint) => text.toLowerCase().includes(hint))) {
                return true;
            }
        }

        if (!('cause' in record)) {
            return false;
        }

        current = record['cause'];
    }

    return false;
};

/**
 * Whether an inference failure is worth retrying: explicit SDK retryability,
 * retry-safe status codes (408/429/5xx), or a network-level transport error.
 * Deterministic client errors (other 4xx, bad config, unknown models) are
 * surfaced immediately.
 */
export const isRetryableInferenceError = (error: unknown): boolean => {
    if (error instanceof ServiceErrorException) {
        return false;
    }

    const details = extractApiErrorDetails(error);
    if (details.isRetryable === true) {
        return true;
    }

    if (details.statusCode !== undefined) {
        return details.statusCode === 408 || details.statusCode === 429 || details.statusCode >= 500;
    }

    return hasNetworkErrorCause(error);
};

const collapseWhitespace = (value: string): string => {
    return value.replace(/\s+/g, ' ').trim();
};

const responseBodySnippet = (responseBody: unknown): string | undefined => {
    if (responseBody === undefined) {
        return undefined;
    }

    const text = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
    const collapsed = collapseWhitespace(text);
    if (collapsed.length === 0) {
        return undefined;
    }

    return collapsed.length > MAX_RESPONSE_BODY_SNIPPET_CHARS
        ? `${collapsed.substring(0, MAX_RESPONSE_BODY_SNIPPET_CHARS)}…`
        : collapsed;
};

/**
 * Client-safe, single-line description of an inference failure. Includes the
 * model, the provider's message, and its status code. Never includes the
 * provider response body: it is untrusted third-party content that can echo
 * request data, and these messages reach client-facing surfaces (interactive
 * chat error chunks, the blocking chat API, and MCP tool responses), including
 * for anonymous requests. Never includes request bodies either (they may
 * contain prompt content). Use `formatInferenceErrorForLog` for server logs.
 */
export const formatInferenceError = (error: unknown, model: Pick<LanguageModel, 'provider' | 'model'>): string => {
    const label = describeLanguageModel(model);
    const message = error instanceof Error ? error.message : String(error);
    const details = extractApiErrorDetails(error);

    let formatted = `[${label}] ${collapseWhitespace(message) || 'Unknown inference error'}`;
    if (details.statusCode !== undefined) {
        formatted += ` (status ${details.statusCode})`;
    }

    return formatted;
};

/**
 * Log-only description of an inference failure. Same as
 * `formatInferenceError` plus a truncated provider response body for
 * debugging. Must only be written to server logs, never returned to clients.
 */
export const formatInferenceErrorForLog = (error: unknown, model: Pick<LanguageModel, 'provider' | 'model'>): string => {
    const formatted = formatInferenceError(error, model);
    const snippet = responseBodySnippet(extractApiErrorDetails(error).responseBody);
    if (snippet) {
        return `${formatted} | provider response: ${snippet}`;
    }

    return formatted;
};

const isValidHttpStatusCode = (statusCode: number): boolean => {
    return Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599;
};

/**
 * Maps any inference failure to a `ServiceError` that preserves the
 * provider's status code and details. `ServiceErrorException`s that do not
 * describe inference failures (e.g. bad request params) pass through
 * untouched so deterministic request errors never look like provider errors.
 */
export const toInferenceServiceError = (error: unknown, model: Pick<LanguageModel, 'provider' | 'model'>): ServiceError => {
    if (error instanceof ServiceErrorException) {
        return error.serviceError;
    }

    const { statusCode } = extractApiErrorDetails(error);
    return {
        statusCode: statusCode !== undefined && isValidHttpStatusCode(statusCode)
            ? statusCode
            : StatusCodes.INTERNAL_SERVER_ERROR,
        errorCode: ErrorCode.INFERENCE_ERROR,
        message: formatInferenceError(error, model),
    };
};

const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Runs `fn` with exponential-backoff retries for transient inference
 * failures. Non-retryable failures (and `ServiceErrorException`s, which
 * describe Sourcebot-side request errors) are rethrown immediately.
 */
export const withInferenceRetries = async <T>(
    fn: () => Promise<T>,
    config: InferenceRetryConfig,
    model: Pick<LanguageModel, 'provider' | 'model'>,
): Promise<T> => {
    const label = describeLanguageModel(model);
    let attempt = 0;
    for (;;) {
        try {
            return await fn();
        } catch (error) {
            if (error instanceof ServiceErrorException || attempt >= config.maxRetries || !isRetryableInferenceError(error)) {
                throw error;
            }

            const delayMs = computeRetryDelayMs(config, attempt);
            logger.warn(`Inference request with model ${label} failed (attempt ${attempt + 1}/${config.maxRetries + 1}). Retrying in ${delayMs}ms. Details: ${formatInferenceErrorForLog(error, model)}`);
            await sleep(delayMs);
            attempt += 1;
        }
    }
};

/**
 * Resolves the ordered candidate chain for a request: the requested model
 * first, then its configured `fallbackModels` in order. References to models
 * that are not configured are skipped with a warning. A reference matches the
 * first configured model with the same provider and model (and display name,
 * when set) that is not already in the chain, so a same-id backup entry is
 * tried instead of silently reusing the primary; references that resolve only
 * to models already in the chain are skipped with a warning.
 */
export const resolveFallbackChain = (primaryModel: LanguageModel, allModels: LanguageModel[]): LanguageModel[] => {
    const chain: LanguageModel[] = [primaryModel];
    const seen = new Set([getLanguageModelKey(primaryModel)]);

    for (const ref of primaryModel.fallbackModels ?? []) {
        if (chain.length > MAX_INFERENCE_FALLBACK_MODELS) {
            break;
        }

        const matches = allModels.filter((candidate) =>
            candidate.provider === ref.provider &&
            candidate.model === ref.model &&
            (ref.displayName === undefined || candidate.displayName === ref.displayName)
        );

        if (matches.length === 0) {
            logger.warn(`Fallback model ${describeLanguageModel(ref)} for ${describeLanguageModel(primaryModel)} is not configured. Skipping.`);
            continue;
        }

        const match = matches.find((candidate) => !seen.has(getLanguageModelKey(candidate)));
        if (!match) {
            logger.warn(`Fallback model ${describeLanguageModel(ref)} for ${describeLanguageModel(primaryModel)} resolves only to models already in the chain. Skipping.`);
            continue;
        }

        seen.add(getLanguageModelKey(match));
        chain.push(match);
    }

    return chain;
};

export type InferenceFallbackOutcome<T> = {
    result: T;
    /** The model that actually served the request (a fallback when the primary failed). */
    modelConfig: LanguageModel;
    primaryModelConfig: LanguageModel;
};

const buildFallbackExhaustedError = (
    candidates: LanguageModel[],
    attemptErrors: { model: LanguageModel; error: unknown }[],
): ServiceError => {
    const attempts = attemptErrors
        .map(({ model, error }) => formatInferenceError(
            error instanceof ServiceErrorException ? error.serviceError.message : error,
            model,
        ))
        .join('; ');

    const lastError = attemptErrors[attemptErrors.length - 1]?.error;
    const lastServiceError = lastError instanceof ServiceErrorException
        ? lastError.serviceError
        : toInferenceServiceError(lastError, candidates[candidates.length - 1]);

    return {
        statusCode: lastServiceError.statusCode,
        errorCode: ErrorCode.INFERENCE_ERROR,
        message: candidates.length === 1
            ? `Inference failed after retries. ${attempts}`
            : `All ${candidates.length} models failed (primary ${describeLanguageModel(candidates[0])} + ${candidates.length - 1} fallback(s)). Attempts: ${attempts}`,
    };
};

/**
 * Runs `run` against the primary model (with retries), falling back through
 * the primary model's configured `fallbackModels` when inference fails
 * transiently. Only retryable inference failures advance to the next model;
 * deterministic failures (e.g. 401/403 provider responses) and non-inference
 * `ServiceErrorException`s (bad request params, entitlement errors, ...) are
 * surfaced immediately without burning fallback attempts.
 */
export const executeWithInferenceFallback = async <T>({
    primaryModel,
    allModels,
    run,
}: {
    primaryModel: LanguageModel;
    allModels: LanguageModel[];
    run: (model: LanguageModel, retryConfig: InferenceRetryConfig) => Promise<T>;
}): Promise<InferenceFallbackOutcome<T>> => {
    const candidates = resolveFallbackChain(primaryModel, allModels);
    const attemptErrors: { model: LanguageModel; error: unknown }[] = [];

    for (let index = 0; index < candidates.length; index++) {
        const candidate = candidates[index];
        const label = describeLanguageModel(candidate);
        if (index > 0) {
            logger.warn(`Falling back to model ${label} after inference failures with ${describeLanguageModel(candidates[index - 1])}.`);
        }

        try {
            const result = await withInferenceRetries(
                () => run(candidate, resolveInferenceRetryConfig(candidate)),
                resolveInferenceRetryConfig(candidate),
                candidate,
            );
            return { result, modelConfig: candidate, primaryModelConfig: primaryModel };
        } catch (error) {
            if (error instanceof ServiceErrorException && error.serviceError.errorCode !== ErrorCode.INFERENCE_ERROR) {
                throw error;
            }

            // Fall back only on transient inference failures. Deterministic
            // failures (e.g. 401/403) and internal errors surface immediately
            // so they are neither retried pointlessly nor misreported as
            // exhausted inference retries.
            const isFallbackEligible = error instanceof ServiceErrorException || isRetryableInferenceError(error);
            if (!isFallbackEligible) {
                throw new ServiceErrorException(toInferenceServiceError(error, candidate));
            }

            attemptErrors.push({ model: candidate, error });
            if (index === candidates.length - 1) {
                throw new ServiceErrorException(buildFallbackExhaustedError(candidates, attemptErrors));
            }

            logger.warn(`Inference with model ${label} failed. Trying the next fallback model. Details: ${formatInferenceErrorForLog(error, candidate)}`);
        }
    }

    // Unreachable: the loop above always returns or throws.
    throw new Error('executeWithInferenceFallback: exhausted candidates without a result');
};
