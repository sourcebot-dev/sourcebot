import { createHash } from "crypto";
import { ProviderOptions } from "@ai-sdk/provider-utils";
import { createLogger } from "@sourcebot/shared";
import { LanguageModelProvider } from "@/features/chat/types";

// @note: Prompt-cache plumbing for the Ask agent. Ask Sourcebot is an
// enterprise feature, so this lives under `ee/`. It is the single place that
// knows about provider-specific cache-control shapes — the agent loop stays
// provider-agnostic by asking the strategy for a `providerOptions` blob at each
// breakpoint and merging whatever it gets back (possibly `undefined`).

const logger = createLogger('prompt-caching');

export type CacheTtl = '5m' | '1h';

export interface PromptCacheStrategy {
    /**
     * Whether the resolved provider supports explicit cache breakpoints. When
     * false, every `cacheControl()` call is a no-op and the request is left
     * untouched (non-Anthropic providers, or caching disabled).
     */
    readonly supportsBreakpoints: boolean;
    /**
     * Returns the `providerOptions` blob to merge onto a system block, tool
     * definition, or message to mark a cache breakpoint — or `undefined` when
     * caching is disabled or the provider does not support explicit breakpoints.
     */
    cacheControl: (opts?: { ttl?: CacheTtl }) => ProviderOptions | undefined;
}

const NOOP_STRATEGY: PromptCacheStrategy = {
    supportsBreakpoints: false,
    cacheControl: () => undefined,
};

// Providers whose `@ai-sdk/*` package consumes the `anthropic` providerOptions
// namespace and honors ephemeral `cacheControl` breakpoints. `google-vertex-anthropic`
// reuses the same namespace; if a given SDK version ignores it the marker is a
// harmless no-op. Bedrock uses a different shape (`cachePoint`) and is intentionally
// not covered here — adding it later is a single new branch.
const ANTHROPIC_FAMILY_PROVIDERS: ReadonlySet<LanguageModelProvider> = new Set<LanguageModelProvider>([
    'anthropic',
    'google-vertex-anthropic',
]);

const anthropicCacheControl = ({ ttl }: { ttl?: CacheTtl } = {}): ProviderOptions => ({
    anthropic: {
        cacheControl: {
            type: 'ephemeral',
            // 5m is the Anthropic default; only emit `ttl` for the 1h bucket.
            ...(ttl === '1h' ? { ttl: '1h' } : {}),
        },
    },
});

/**
 * Resolves how (and whether) to emit prompt-cache breakpoints for a provider.
 * Non-Anthropic providers, or a disabled master flag, yield a no-op strategy so
 * their requests are never perturbed.
 */
export const getPromptCacheStrategy = (
    provider: LanguageModelProvider,
    enabled: boolean,
): PromptCacheStrategy => {
    if (!enabled || !ANTHROPIC_FAMILY_PROVIDERS.has(provider)) {
        return NOOP_STRATEGY;
    }

    return {
        supportsBreakpoints: true,
        cacheControl: (opts) => anthropicCacheControl(opts),
    };
};

/**
 * Deep-merges a cache-control marker's `providerOptions` onto any existing
 * `providerOptions`, preserving sibling provider namespaces and other options
 * within the same namespace (e.g. `anthropic.thinking`). Returns the original
 * value unchanged when there is no marker to apply.
 */
export const mergeProviderOptions = (
    existing: ProviderOptions | undefined,
    marker: ProviderOptions | undefined,
): ProviderOptions | undefined => {
    if (!marker) {
        return existing;
    }
    if (!existing) {
        return marker;
    }

    const merged: ProviderOptions = { ...existing };
    for (const [namespace, options] of Object.entries(marker)) {
        merged[namespace] = {
            ...(existing[namespace] ?? {}),
            ...options,
        };
    }
    return merged;
};

// --- Cache-break detection (observability only; never throws) ---------------

interface CacheBreakSnapshot {
    signature: string;
    requestCount: number;
}

// Keyed by chatId, in-memory, observability-only. Entries are never removed on chat
// end, so the map is bounded by a FIFO cap (oldest insertion evicted first, below);
// otherwise it grows with the cumulative count of distinct chats, not the concurrent count.
const MAX_CACHE_BREAK_SNAPSHOTS = 10_000;
const cacheBreakSnapshots = new Map<string, CacheBreakSnapshot>();

const hashString = (input: string): string =>
    createHash('sha256').update(input).digest('hex').slice(0, 16);

/**
 * Records the cache-relevant prefix signature for a chat and logs a warning when
 * it changes between requests in a way that would invalidate the static prompt
 * cache. Observability only — never affects request behavior.
 */
export const detectPromptCacheBreak = ({
    chatId,
    staticPrompt,
    toolSignature,
    model,
    staticTtl,
}: {
    chatId: string;
    staticPrompt: string;
    toolSignature: string;
    model: string;
    staticTtl: CacheTtl;
}): void => {
    try {
        const signature = hashString([
            model,
            staticTtl,
            hashString(staticPrompt),
            hashString(toolSignature),
        ].join('|'));

        const prev = cacheBreakSnapshots.get(chatId);
        const requestCount = (prev?.requestCount ?? 0) + 1;
        cacheBreakSnapshots.set(chatId, { signature, requestCount });

        // FIFO eviction: once the map overflows, drop the oldest-inserted entry.
        if (cacheBreakSnapshots.size > MAX_CACHE_BREAK_SNAPSHOTS) {
            const oldestKey = cacheBreakSnapshots.keys().next().value;
            if (oldestKey !== undefined) {
                cacheBreakSnapshots.delete(oldestKey);
            }
        }

        if (prev && prev.signature !== signature) {
            logger.warn(
                `Prompt cache break detected for chat ${chatId} (request #${requestCount}): the ` +
                `static system prompt, built-in tool definitions, model, or TTL changed between ` +
                `requests, invalidating the static cache prefix.`,
            );
        }
    } catch (error) {
        logger.debug(`detectPromptCacheBreak failed: ${error}`);
    }
};

/**
 * Logs a warning when a non-first agent step reports zero cache-read tokens while
 * caching is supported — a likely byte-stability regression. Observability only.
 */
export const detectUnexpectedCacheMiss = ({
    chatId,
    stepIndex,
    cacheReadTokens,
    supportsBreakpoints,
}: {
    chatId: string;
    stepIndex: number;
    cacheReadTokens: number | undefined;
    supportsBreakpoints: boolean;
}): void => {
    if (!supportsBreakpoints || stepIndex === 0) {
        return;
    }
    if ((cacheReadTokens ?? 0) === 0) {
        logger.warn(
            `Prompt cache miss for chat ${chatId} at step ${stepIndex}: cacheReadTokens=0 on a ` +
            `continuation step where a cache hit was expected (likely a byte-stability regression).`,
        );
    }
};
