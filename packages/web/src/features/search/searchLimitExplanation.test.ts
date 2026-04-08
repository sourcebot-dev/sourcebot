import { expect, test } from 'vitest';
import type { SearchStats } from './types';
import { getSearchLimitExplanation } from './searchLimitExplanation';

function stats(overrides: Partial<SearchStats>): SearchStats {
    return {
        actualMatchCount: 10,
        totalMatchCount: 10,
        duration: 0,
        fileCount: 1,
        filesSkipped: 0,
        contentBytesLoaded: 0,
        indexBytesLoaded: 0,
        crashes: 0,
        shardFilesConsidered: 0,
        filesConsidered: 0,
        filesLoaded: 0,
        shardsScanned: 1,
        shardsSkipped: 0,
        shardsSkippedFilter: 0,
        ngramMatches: 0,
        ngramLookups: 0,
        wait: 0,
        matchTreeConstruction: 0,
        matchTreeSearch: 0,
        regexpsConsidered: 0,
        flushReason: 'FLUSH_REASON_UNKNOWN_UNSPECIFIED',
        ...overrides,
    };
}

test('missing stats yields generic incomplete message', () => {
    const out = getSearchLimitExplanation(undefined, 100);
    expect(out.summary).toContain('incomplete');
});

test('shardsSkipped takes precedence (time limit / partial scan)', () => {
    const out = getSearchLimitExplanation(
        stats({
            shardsSkipped: 2,
            totalMatchCount: 500,
            filesSkipped: 99,
        }),
        100,
    );
    expect(out.summary).toContain('did not scan the entire index');
});

test('totalMatchCount above display cap explains match budget', () => {
    const out = getSearchLimitExplanation(
        stats({
            actualMatchCount: 100,
            totalMatchCount: 250,
        }),
        100,
    );
    expect(out.summary).toContain('More matches exist');
    expect(out.detail).toContain('250');
});

test('filesSkipped without shard skip explains early stop', () => {
    const out = getSearchLimitExplanation(
        stats({
            totalMatchCount: 50,
            actualMatchCount: 50,
            filesSkipped: 10,
        }),
        100,
    );
    expect(out.summary).toContain('candidate files');
});

test('flushReason timer when no higher-priority signal', () => {
    const out = getSearchLimitExplanation(
        stats({
            flushReason: 'FLUSH_REASON_TIMER_EXPIRED',
            totalMatchCount: 10,
            actualMatchCount: 10,
        }),
        100,
    );
    expect(out.summary).toContain('streaming timer');
});
