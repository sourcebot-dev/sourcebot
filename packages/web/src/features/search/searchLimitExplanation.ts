import type { SearchStats } from './types';

/** Values from zoekt `FlushReason` (grpc string enum names). */
const FLUSH_REASON_TIMER_EXPIRED = 'FLUSH_REASON_TIMER_EXPIRED';
const FLUSH_REASON_MAX_SIZE = 'FLUSH_REASON_MAX_SIZE';

/**
 * User-facing copy when Zoekt returned a non-exhaustive search (more matches may exist
 * than were returned or scanned).
 *
 * @see https://github.com/sourcebot-dev/sourcebot/issues/504
 */
export function getSearchLimitExplanation(
    stats: SearchStats | undefined,
    maxMatchDisplayCount: number,
): { summary: string; detail?: string } {
    if (!stats) {
        return {
            summary: 'Results may be incomplete.',
            detail: 'Increase the match limit, narrow your query, or scope to a repository.',
        };
    }

    if (stats.shardsSkipped > 0) {
        return {
            summary: 'Search did not scan the entire index.',
            detail: 'One or more index shards were skipped (often because the search hit a time limit). Additional matches may exist.',
        };
    }

    if (stats.flushReason === FLUSH_REASON_TIMER_EXPIRED) {
        return {
            summary: 'Results were flushed early due to a streaming timer.',
            detail: 'Try narrowing your query or increasing limits.',
        };
    }

    if (stats.flushReason === FLUSH_REASON_MAX_SIZE) {
        return {
            summary: 'Intermediate result set reached its size limit.',
            detail: 'Try narrowing your query or increasing limits.',
        };
    }

    if (stats.totalMatchCount > maxMatchDisplayCount) {
        return {
            summary: 'More matches exist than are shown.',
            detail: `The index reported ${stats.totalMatchCount} matches, but this request only returns up to ${maxMatchDisplayCount}. Use “load more” or raise the match limit.`,
        };
    }

    if (stats.filesSkipped > 0) {
        return {
            summary: 'Some candidate files were not fully searched.',
            detail: 'The engine stopped after finding enough matches (per-shard or total limits). Additional matches may exist.',
        };
    }

    // Defensive fallback: non-exhaustive searches should usually hit a branch above
    // (e.g. totalMatchCount vs display cap, skipped shards/files, or flush reason).
    return {
        summary: 'More matches may exist than are shown.',
        detail: 'Increase the match limit, narrow your query, or scope to a repository.',
    };
}
