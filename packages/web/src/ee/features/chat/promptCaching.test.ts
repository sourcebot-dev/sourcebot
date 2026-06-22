import { describe, expect, test, vi } from 'vitest';

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    }),
}));

const { getPromptCacheStrategy, mergeProviderOptions } = await import('./promptCaching');

describe('getPromptCacheStrategy', () => {
    test.each(['anthropic', 'google-vertex-anthropic'] as const)(
        'returns a 5m ephemeral marker (no ttl) for %s when enabled',
        (provider) => {
            const strategy = getPromptCacheStrategy(provider, true);
            expect(strategy.supportsBreakpoints).toBe(true);
            expect(strategy.cacheControl()).toEqual({
                anthropic: { cacheControl: { type: 'ephemeral' } },
            });
        },
    );

    test('includes ttl only for the 1h bucket', () => {
        const strategy = getPromptCacheStrategy('anthropic', true);
        expect(strategy.cacheControl({ ttl: '1h' })).toEqual({
            anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } },
        });
        // 5m is the default — ttl is omitted so the request matches Anthropic's
        // default and stays byte-stable.
        expect(strategy.cacheControl({ ttl: '5m' })).toEqual({
            anthropic: { cacheControl: { type: 'ephemeral' } },
        });
    });

    test.each([
        'amazon-bedrock',
        'azure',
        'deepseek',
        'google-generative-ai',
        'google-vertex',
        'mistral',
        'openai',
        'openai-compatible',
        'openrouter',
        'xai',
    ] as const)('is a no-op for non-Anthropic provider %s', (provider) => {
        const strategy = getPromptCacheStrategy(provider, true);
        expect(strategy.supportsBreakpoints).toBe(false);
        expect(strategy.cacheControl()).toBeUndefined();
        expect(strategy.cacheControl({ ttl: '1h' })).toBeUndefined();
    });

    test('is a no-op when caching is disabled, even for Anthropic', () => {
        const strategy = getPromptCacheStrategy('anthropic', false);
        expect(strategy.supportsBreakpoints).toBe(false);
        expect(strategy.cacheControl()).toBeUndefined();
    });
});

describe('mergeProviderOptions', () => {
    test('returns the existing options unchanged when there is no marker', () => {
        const existing = { anthropic: { thinking: { type: 'enabled' } } };
        expect(mergeProviderOptions(existing, undefined)).toBe(existing);
    });

    test('returns the marker when there are no existing options', () => {
        const marker = { anthropic: { cacheControl: { type: 'ephemeral' } } };
        expect(mergeProviderOptions(undefined, marker)).toBe(marker);
    });

    test('deep-merges the cacheControl while preserving sibling options in the same namespace', () => {
        const existing = { anthropic: { thinking: { type: 'enabled', budgetTokens: 1024 } } };
        const marker = { anthropic: { cacheControl: { type: 'ephemeral' } } };
        expect(mergeProviderOptions(existing, marker)).toEqual({
            anthropic: {
                thinking: { type: 'enabled', budgetTokens: 1024 },
                cacheControl: { type: 'ephemeral' },
            },
        });
    });

    test('preserves sibling provider namespaces', () => {
        const existing = { openai: { someOption: true } };
        const marker = { anthropic: { cacheControl: { type: 'ephemeral' } } };
        expect(mergeProviderOptions(existing, marker)).toEqual({
            openai: { someOption: true },
            anthropic: { cacheControl: { type: 'ephemeral' } },
        });
    });
});
