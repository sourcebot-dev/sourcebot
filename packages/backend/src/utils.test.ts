import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { arraysEqualShallow, fetchWithRetry } from './utils';
import { isRemotePath } from '@sourcebot/shared';
import { Logger } from 'winston';
import { RequestError } from '@octokit/request-error';

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

const createMockLogger = (): Logger => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
} as unknown as Logger);

test('should return true for identical arrays', () => {
    expect(arraysEqualShallow([1, 2, 3], [1, 2, 3])).toBe(true);
});

test('should return true for empty arrays', () => {
    expect(arraysEqualShallow([], [])).toBe(true);
});

test('should return true for same array reference', () => {
    const arr = [1, 2, 3];
    expect(arraysEqualShallow(arr, arr)).toBe(true);
});

test('should return false when one array is undefined', () => {
    expect(arraysEqualShallow([1, 2, 3], undefined)).toBe(false);
    expect(arraysEqualShallow(undefined, [1, 2, 3])).toBe(false);
});

test('should return false for arrays with different lengths', () => {
    expect(arraysEqualShallow([1, 2], [1, 2, 3])).toBe(false);
});

test('should return true for arrays with same elements in different order', () => {
    expect(arraysEqualShallow([1, 2, 3], [3, 2, 1])).toBe(true);
});

test('should return false for arrays with different elements', () => {
    expect(arraysEqualShallow([1, 2, 3], [1, 2, 4])).toBe(false);
});

test('should handle arrays with string elements', () => {
    expect(arraysEqualShallow(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(arraysEqualShallow(['a', 'b'], ['a', 'c'])).toBe(false);
});

test('should handle arrays with duplicate elements', () => {
    expect(arraysEqualShallow([1, 1, 2], [1, 2, 1])).toBe(true);
    expect(arraysEqualShallow([1, 1], [1])).toBe(false);
    expect(arraysEqualShallow([1, 2, 2], [1, 1, 2])).toBe(false);
});

test('should not mutate the array', () => {
    const a = [1, 2, 3];
    const b = [3, 2, 1];
    expect(arraysEqualShallow(a, b)).toBe(true);
    expect(a[0]).toBe(1);
    expect(a[1]).toBe(2);
    expect(a[2]).toBe(3);
    expect(b[0]).toBe(3);
    expect(b[1]).toBe(2);
    expect(b[2]).toBe(1);
});

test('isRemotePath should return true for HTTP or HTTPS URLs', () => {
    expect(isRemotePath('https://example.com')).toBe(true);
    expect(isRemotePath('https://github.com/repo')).toBe(true);
    expect(isRemotePath('http://example.com')).toBe(true);
    expect(isRemotePath('http://localhost:3000')).toBe(true);
});

test('isRemotePath should return false for non HTTP paths', () => {
    expect(isRemotePath('/usr/local/bin')).toBe(false);
    expect(isRemotePath('./relative/path')).toBe(false);
    expect(isRemotePath('C:\\Windows\\System32')).toBe(false);
    expect(isRemotePath('')).toBe(false);
    expect(isRemotePath('   ')).toBe(false);
});

describe('fetchWithRetry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('returns result on successful fetch', async () => {
        const logger = createMockLogger();
        const fetchFn = vi.fn().mockResolvedValue('success');

        const result = await fetchWithRetry(fetchFn, 'test', logger);

        expect(result).toBe('success');
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    test('throws immediately for non-retryable errors (e.g., 404)', async () => {
        const logger = createMockLogger();
        const error = { status: 404, message: 'Not Found' };
        const fetchFn = vi.fn().mockRejectedValue(error);

        await expect(fetchWithRetry(fetchFn, 'test', logger)).rejects.toEqual(error);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    test('throws immediately for non-retryable errors (e.g., 401)', async () => {
        const logger = createMockLogger();
        const error = { status: 401, message: 'Unauthorized' };
        const fetchFn = vi.fn().mockRejectedValue(error);

        await expect(fetchWithRetry(fetchFn, 'test', logger)).rejects.toEqual(error);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    test('retries on 429 (Too Many Requests) and succeeds', async () => {
        const logger = createMockLogger();
        const error = { status: 429, message: 'Too Many Requests' };
        const fetchFn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce('success');

        const resultPromise = fetchWithRetry(fetchFn, 'test', logger);

        // Advance timer to trigger retry
        await vi.advanceTimersByTimeAsync(3000);

        const result = await resultPromise;
        expect(result).toBe('success');
        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(logger.warn).toHaveBeenCalled();
    });

    test('retries on 403 (Forbidden) and succeeds', async () => {
        const logger = createMockLogger();
        const error = { status: 403, message: 'Forbidden' };
        const fetchFn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce('success');

        const resultPromise = fetchWithRetry(fetchFn, 'test', logger);

        await vi.advanceTimersByTimeAsync(3000);

        const result = await resultPromise;
        expect(result).toBe('success');
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    test('retries on 503 (Service Unavailable) and succeeds', async () => {
        const logger = createMockLogger();
        const error = { status: 503, message: 'Service Unavailable' };
        const fetchFn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce('success');

        const resultPromise = fetchWithRetry(fetchFn, 'test', logger);

        await vi.advanceTimersByTimeAsync(3000);

        const result = await resultPromise;
        expect(result).toBe('success');
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    test('retries on 500 (Internal Server Error) and succeeds', async () => {
        const logger = createMockLogger();
        const error = { status: 500, message: 'Internal Server Error' };
        const fetchFn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce('success');

        const resultPromise = fetchWithRetry(fetchFn, 'test', logger);

        await vi.advanceTimersByTimeAsync(3000);

        const result = await resultPromise;
        expect(result).toBe('success');
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    test('throws after max attempts exceeded', async () => {
        const logger = createMockLogger();
        const error = { status: 429, message: 'Too Many Requests' };
        const fetchFn = vi.fn().mockRejectedValue(error);

        const resultPromise = fetchWithRetry(fetchFn, 'test', logger, 3);
        // Prevent unhandled rejection warning while we advance timers
        resultPromise.catch(() => {});

        // Advance through all retry attempts
        await vi.advanceTimersByTimeAsync(3000); // 1st retry
        await vi.advanceTimersByTimeAsync(6000); // 2nd retry

        await expect(resultPromise).rejects.toEqual(error);
        expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    test('uses exponential backoff for wait times', async () => {
        const logger = createMockLogger();
        const error = { status: 429, message: 'Too Many Requests' };
        const fetchFn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce('success');

        const resultPromise = fetchWithRetry(fetchFn, 'test', logger, 4);

        // First retry: 3000 * 2^0 = 3000ms
        await vi.advanceTimersByTimeAsync(3000);
        expect(fetchFn).toHaveBeenCalledTimes(2);

        // Second retry: 3000 * 2^1 = 6000ms
        await vi.advanceTimersByTimeAsync(6000);
        expect(fetchFn).toHaveBeenCalledTimes(3);

        const result = await resultPromise;
        expect(result).toBe('success');
    });

    test('respects x-ratelimit-reset header for Octokit errors', async () => {
        const logger = createMockLogger();
        const now = Date.now();
        const resetTime = Math.floor((now + 5000) / 1000); // 5 seconds from now

        const error = new RequestError('Rate limit exceeded', 429, {
            response: {
                headers: {
                    'x-ratelimit-reset': String(resetTime),
                },
                status: 429,
                url: 'https://api.github.com/test',
                data: {},
            },
            request: {
                method: 'GET',
                url: 'https://api.github.com/test',
                headers: {},
            },
        });

        const fetchFn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce('success');

        const resultPromise = fetchWithRetry(fetchFn, 'test', logger);

        // Should wait approximately 5000ms based on the reset header
        await vi.advanceTimersByTimeAsync(5000);

        const result = await resultPromise;
        expect(result).toBe('success');
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    test('respects custom maxAttempts parameter', async () => {
        const logger = createMockLogger();
        const error = { status: 503, message: 'Service Unavailable' };
        const fetchFn = vi.fn().mockRejectedValue(error);

        const resultPromise = fetchWithRetry(fetchFn, 'test', logger, 2);
        // Prevent unhandled rejection warning while we advance timers
        resultPromise.catch(() => {});

        await vi.advanceTimersByTimeAsync(3000);

        await expect(resultPromise).rejects.toEqual(error);
        expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    test('logs warning on each retry attempt', async () => {
        const logger = createMockLogger();
        const error = { status: 429, message: 'Too Many Requests' };
        const fetchFn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce('success');

        const resultPromise = fetchWithRetry(fetchFn, 'test-identifier', logger);

        await vi.advanceTimersByTimeAsync(3000);
        await resultPromise;

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('test-identifier')
        );
    });
});
