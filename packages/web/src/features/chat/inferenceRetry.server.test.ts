import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    class FakeAPICallError extends Error {
        static isInstance(error: unknown): boolean {
            return error instanceof FakeAPICallError;
        }

        statusCode?: number;
        responseBody?: unknown;
        url?: string;
        isRetryable?: boolean;

        constructor(opts: { message: string; statusCode?: number; responseBody?: unknown; url?: string; isRetryable?: boolean }) {
            super(opts.message);
            this.name = 'AI_APICallError';
            this.statusCode = opts.statusCode;
            this.responseBody = opts.responseBody;
            this.url = opts.url;
            this.isRetryable = opts.isRetryable;
        }
    }

    return {
        FakeAPICallError,
        logger: {
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
        },
    };
});

vi.mock('server-only', () => ({}));
vi.mock('ai', () => ({
    APICallError: mocks.FakeAPICallError,
}));
vi.mock('@/features/chat/logger', () => ({
    logger: mocks.logger,
}));
vi.mock('@/features/chat/utils', () => ({
    getLanguageModelKey: (model: { provider: string; model: string; displayName?: string }) =>
        `${model.provider}-${model.model}-${model.displayName}`,
}));

import {
    computeRetryDelayMs,
    describeLanguageModel,
    executeWithInferenceFallback,
    formatInferenceError,
    isRetryableInferenceError,
    resolveFallbackChain,
    resolveInferenceRetryConfig,
    toInferenceServiceError,
    withInferenceRetries,
} from './inferenceRetry.server';
import { ErrorCode } from '@/lib/errorCodes';
import { ServiceErrorException } from '@/lib/serviceError';
import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { StatusCodes } from 'http-status-codes';

const openaiModel = (overrides: Partial<LanguageModel> = {}): LanguageModel => ({
    provider: 'openai',
    model: 'gpt-4o',
    ...overrides,
} as LanguageModel);

const anthropicModel = (overrides: Partial<LanguageModel> = {}): LanguageModel => ({
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    ...overrides,
} as LanguageModel);

const apiError = (opts: { message: string; statusCode?: number; responseBody?: unknown; isRetryable?: boolean }) =>
    new mocks.FakeAPICallError({ url: 'https://api.provider.test/v1/chat', ...opts });

beforeEach(() => {
    mocks.logger.warn.mockReset();
    mocks.logger.error.mockReset();
});

describe('resolveInferenceRetryConfig', () => {
    test('applies defaults when no retry policy is configured', () => {
        expect(resolveInferenceRetryConfig(openaiModel())).toEqual({
            maxRetries: 3,
            initialBackoffMs: 500,
            maxBackoffMs: 8000,
        });
    });

    test('honors a per-model retry policy', () => {
        expect(resolveInferenceRetryConfig(openaiModel({
            retry: { maxRetries: 1, initialBackoffMs: 100, maxBackoffMs: 1000 },
        }))).toEqual({
            maxRetries: 1,
            initialBackoffMs: 100,
            maxBackoffMs: 1000,
        });
    });

    test('clamps out-of-range values', () => {
        expect(resolveInferenceRetryConfig(openaiModel({
            retry: { maxRetries: 99, initialBackoffMs: -5, maxBackoffMs: 999999999 },
        }))).toEqual({
            maxRetries: 10,
            initialBackoffMs: 0,
            maxBackoffMs: 120000,
        });
    });
});

describe('computeRetryDelayMs', () => {
    test('backs off exponentially up to the cap', () => {
        const config = { maxRetries: 5, initialBackoffMs: 500, maxBackoffMs: 1200 };
        expect(computeRetryDelayMs(config, 0)).toBe(500);
        expect(computeRetryDelayMs(config, 1)).toBe(1000);
        expect(computeRetryDelayMs(config, 2)).toBe(1200);
    });
});

describe('isRetryableInferenceError', () => {
    test('retries rate limits and server errors', () => {
        expect(isRetryableInferenceError(apiError({ message: 'slow down', statusCode: 429 }))).toBe(true);
        expect(isRetryableInferenceError(apiError({ message: 'boom', statusCode: 500 }))).toBe(true);
        expect(isRetryableInferenceError(apiError({ message: 'timeout', statusCode: 408 }))).toBe(true);
    });

    test('does not retry deterministic client errors', () => {
        expect(isRetryableInferenceError(apiError({ message: 'bad request', statusCode: 400 }))).toBe(false);
        expect(isRetryableInferenceError(apiError({ message: 'unauthorized', statusCode: 401 }))).toBe(false);
        expect(isRetryableInferenceError(apiError({ message: 'not found', statusCode: 404 }))).toBe(false);
    });

    test('honors the SDK retryability flag', () => {
        expect(isRetryableInferenceError(apiError({ message: 'ok', statusCode: 200, isRetryable: true }))).toBe(true);
    });

    test('retries network-level transport failures', () => {
        expect(isRetryableInferenceError(new TypeError('fetch failed'))).toBe(true);
        const reset = new TypeError('terminated');
        (reset as unknown as Record<string, unknown>)['cause'] = { code: 'ECONNRESET' };
        expect(isRetryableInferenceError(reset)).toBe(true);
    });

    test('does not retry unknown errors or Sourcebot service errors', () => {
        expect(isRetryableInferenceError(new Error('boom'))).toBe(false);
        expect(isRetryableInferenceError(new ServiceErrorException({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: 'bad repo',
        }))).toBe(false);
    });
});

describe('formatInferenceError', () => {
    test('includes the model, message, status code, and provider response', () => {
        const formatted = formatInferenceError(
            apiError({ message: 'Resource exhausted', statusCode: 429, responseBody: '{"error":{"code":429}}' }),
            { provider: 'openai', model: 'gpt-4o' },
        );
        expect(formatted).toBe('[openai/gpt-4o] Resource exhausted (status 429) | provider response: {"error":{"code":429}}');
    });

    test('never leaks request bodies', () => {
        const error = apiError({ message: 'bad', statusCode: 500 });
        (error as unknown as Record<string, unknown>)['requestBodyValues'] = { secret: 'super-secret-prompt' };
        const formatted = formatInferenceError(error, { provider: 'openai', model: 'gpt-4o' });
        expect(formatted).not.toContain('super-secret-prompt');
    });

    test('truncates long provider responses', () => {
        const formatted = formatInferenceError(
            apiError({ message: 'bad', statusCode: 500, responseBody: `{"data":"${'x'.repeat(1000)}"}` }),
            { provider: 'openai', model: 'gpt-4o' },
        );
        expect(formatted.length).toBeLessThan(700);
        expect(formatted).toContain('…');
    });
});

describe('toInferenceServiceError', () => {
    test('passes the provider status code through', () => {
        const serviceError = toInferenceServiceError(
            apiError({ message: 'slow down', statusCode: 429 }),
            { provider: 'openai', model: 'gpt-4o' },
        );
        expect(serviceError.statusCode).toBe(429);
        expect(serviceError.errorCode).toBe(ErrorCode.INFERENCE_ERROR);
        expect(serviceError.message).toContain('[openai/gpt-4o]');
        expect(serviceError.message).toContain('slow down');
    });

    test('falls back to 500 without a provider status code', () => {
        const serviceError = toInferenceServiceError(new Error('boom'), { provider: 'openai', model: 'gpt-4o' });
        expect(serviceError.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(serviceError.errorCode).toBe(ErrorCode.INFERENCE_ERROR);
    });

    test('passes non-inference service errors through untouched', () => {
        const original = {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: 'bad repo',
        };
        expect(toInferenceServiceError(
            new ServiceErrorException(original),
            { provider: 'openai', model: 'gpt-4o' },
        )).toBe(original);
    });
});

describe('resolveFallbackChain', () => {
    test('returns just the primary model when no fallbacks are configured', () => {
        const primary = openaiModel();
        expect(resolveFallbackChain(primary, [primary])).toEqual([primary]);
    });

    test('resolves configured fallbacks in order', () => {
        const primary = openaiModel({
            fallbackModels: [
                { provider: 'anthropic', model: 'claude-sonnet-4-5' },
                { provider: 'openai', model: 'gpt-4o-mini' },
            ],
        });
        const fallbackA = anthropicModel();
        const fallbackB = openaiModel({ model: 'gpt-4o-mini' });
        expect(resolveFallbackChain(primary, [primary, fallbackA, fallbackB])).toEqual([primary, fallbackA, fallbackB]);
    });

    test('skips unconfigured fallbacks, self-references, and duplicates', () => {
        const primary = openaiModel({
            fallbackModels: [
                { provider: 'openai', model: 'gpt-4o' },
                { provider: 'anthropic', model: 'missing-model' },
                { provider: 'anthropic', model: 'claude-sonnet-4-5' },
                { provider: 'anthropic', model: 'claude-sonnet-4-5' },
            ],
        });
        const fallback = anthropicModel();
        expect(resolveFallbackChain(primary, [primary, fallback])).toEqual([primary, fallback]);
        expect(mocks.logger.warn).toHaveBeenCalled();
    });

    test('matches on displayName when the reference sets one', () => {
        const primary = openaiModel({
            fallbackModels: [{ provider: 'anthropic', model: 'claude', displayName: 'Work Claude' }],
        });
        const other = anthropicModel({ model: 'claude', displayName: 'Personal Claude' });
        const match = anthropicModel({ model: 'claude', displayName: 'Work Claude' });
        expect(resolveFallbackChain(primary, [primary, other, match])).toEqual([primary, match]);
    });
});

describe('withInferenceRetries', () => {
    const fastConfig = { maxRetries: 2, initialBackoffMs: 1, maxBackoffMs: 1 };

    test('returns immediately on success', async () => {
        const fn = vi.fn().mockResolvedValue('ok');
        await expect(withInferenceRetries(fn, fastConfig, { provider: 'openai', model: 'gpt-4o' })).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('retries transient failures and then succeeds', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(apiError({ message: 'busy', statusCode: 429 }))
            .mockResolvedValueOnce('ok');
        await expect(withInferenceRetries(fn, fastConfig, { provider: 'openai', model: 'gpt-4o' })).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    test('does not retry deterministic failures', async () => {
        const fn = vi.fn().mockRejectedValue(apiError({ message: 'bad key', statusCode: 401 }));
        await expect(withInferenceRetries(fn, fastConfig, { provider: 'openai', model: 'gpt-4o' })).rejects.toThrow('bad key');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('gives up after maxRetries', async () => {
        const fn = vi.fn().mockRejectedValue(apiError({ message: 'down', statusCode: 503 }));
        await expect(withInferenceRetries(fn, fastConfig, { provider: 'openai', model: 'gpt-4o' })).rejects.toThrow('down');
        expect(fn).toHaveBeenCalledTimes(3);
    });
});

describe('executeWithInferenceFallback', () => {
    test('serves from the primary model when it succeeds', async () => {
        const primary = openaiModel();
        const run = vi.fn().mockResolvedValue('answer');
        const outcome = await executeWithInferenceFallback({
            primaryModel: primary,
            allModels: [primary],
            run,
        });
        expect(outcome.result).toBe('answer');
        expect(outcome.modelConfig).toBe(primary);
        expect(run).toHaveBeenCalledTimes(1);
    });

    test('falls back to the next model after retries are exhausted', async () => {
        const primary = openaiModel({
            retry: { maxRetries: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
            fallbackModels: [{ provider: 'anthropic', model: 'claude-sonnet-4-5' }],
        });
        const fallback = anthropicModel();
        const run = vi.fn()
            .mockRejectedValueOnce(apiError({ message: 'primary down', statusCode: 503 }))
            .mockRejectedValueOnce(apiError({ message: 'primary still down', statusCode: 503 }))
            .mockResolvedValueOnce('fallback answer');

        const outcome = await executeWithInferenceFallback({
            primaryModel: primary,
            allModels: [primary, fallback],
            run,
        });

        expect(outcome.result).toBe('fallback answer');
        expect(outcome.modelConfig).toBe(fallback);
        // 1 initial attempt + 1 retry on the primary, then the fallback.
        expect(run).toHaveBeenCalledTimes(3);
    });

    test('aggregates every attempt when all models fail', async () => {
        const primary = openaiModel({
            retry: { maxRetries: 0 },
            fallbackModels: [{ provider: 'anthropic', model: 'claude-sonnet-4-5' }],
        });
        const fallback = anthropicModel({ retry: { maxRetries: 0 } });
        const run = vi.fn()
            .mockRejectedValueOnce(apiError({ message: 'primary down', statusCode: 503 }))
            .mockRejectedValueOnce(apiError({ message: 'fallback limited', statusCode: 429 }));

        const failure = await executeWithInferenceFallback({
            primaryModel: primary,
            allModels: [primary, fallback],
            run,
        }).catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(ServiceErrorException);
        const serviceError = (failure as ServiceErrorException).serviceError;
        expect(serviceError.errorCode).toBe(ErrorCode.INFERENCE_ERROR);
        expect(serviceError.statusCode).toBe(429);
        expect(serviceError.message).toContain('[openai/gpt-4o]');
        expect(serviceError.message).toContain('[anthropic/claude-sonnet-4-5]');
        expect(serviceError.message).toContain('primary down');
        expect(serviceError.message).toContain('fallback limited');
    });

    test('rethrows deterministic request errors without falling back', async () => {
        const primary = openaiModel({
            fallbackModels: [{ provider: 'anthropic', model: 'claude-sonnet-4-5' }],
        });
        const fallback = anthropicModel();
        const requestError = new ServiceErrorException({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: "Repository 'x' not found.",
        });
        const run = vi.fn().mockRejectedValue(requestError);

        await expect(executeWithInferenceFallback({
            primaryModel: primary,
            allModels: [primary, fallback],
            run,
        })).rejects.toBe(requestError);
        expect(run).toHaveBeenCalledTimes(1);
    });
});

describe('describeLanguageModel', () => {
    test('labels a model as provider/model', () => {
        expect(describeLanguageModel({ provider: 'openai', model: 'gpt-4o' })).toBe('openai/gpt-4o');
    });
});
