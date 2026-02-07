import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    parseTemporalDate,
    validateDateRange,
    toDbDate,
    toGitDate,
} from './dateUtils';

describe('dateUtils', () => {
    // Mock the current time for consistent testing
    const MOCK_NOW = new Date('2024-06-15T12:00:00.000Z');

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(MOCK_NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('parseTemporalDate', () => {
        describe('ISO 8601 dates', () => {
            it('should parse ISO date (YYYY-MM-DD)', () => {
                const result = parseTemporalDate('2024-01-01');
                expect(result).toBe('2024-01-01T00:00:00.000Z');
            });

            it('should parse ISO datetime with timezone', () => {
                const result = parseTemporalDate('2024-01-01T12:30:00Z');
                expect(result).toBe('2024-01-01T12:30:00.000Z');
            });

            it('should parse ISO datetime without timezone', () => {
                const result = parseTemporalDate('2024-01-01T12:30:00');
                expect(result).toBeDefined();
                expect(result).toContain('2024-01-01');
            });

            it('should return undefined for undefined input', () => {
                const result = parseTemporalDate(undefined);
                expect(result).toBeUndefined();
            });

            it('should return undefined for empty string', () => {
                const result = parseTemporalDate('');
                expect(result).toBeUndefined();
            });
        });

        describe('relative dates - yesterday', () => {
            it('should parse "yesterday"', () => {
                const result = parseTemporalDate('yesterday');
                expect(result).toBe('2024-06-14T12:00:00.000Z');
            });

            it('should parse "YESTERDAY" (case insensitive)', () => {
                const result = parseTemporalDate('YESTERDAY');
                expect(result).toBe('2024-06-14T12:00:00.000Z');
            });
        });

        describe('relative dates - N units ago', () => {
            it('should parse "1 day ago"', () => {
                const result = parseTemporalDate('1 day ago');
                expect(result).toBe('2024-06-14T12:00:00.000Z');
            });

            it('should parse "30 days ago"', () => {
                const result = parseTemporalDate('30 days ago');
                expect(result).toBe('2024-05-16T12:00:00.000Z');
            });

            it('should parse "1 week ago"', () => {
                const result = parseTemporalDate('1 week ago');
                expect(result).toBe('2024-06-08T12:00:00.000Z');
            });

            it('should parse "2 weeks ago"', () => {
                const result = parseTemporalDate('2 weeks ago');
                expect(result).toBe('2024-06-01T12:00:00.000Z');
            });

            it('should parse "1 month ago"', () => {
                const result = parseTemporalDate('1 month ago');
                expect(result).toBe('2024-05-15T12:00:00.000Z');
            });

            it('should parse "3 months ago"', () => {
                const result = parseTemporalDate('3 months ago');
                expect(result).toBe('2024-03-15T12:00:00.000Z');
            });

            it('should parse "1 year ago"', () => {
                const result = parseTemporalDate('1 year ago');
                expect(result).toBe('2023-06-15T12:00:00.000Z');
            });

            it('should parse "2 hours ago"', () => {
                const result = parseTemporalDate('2 hours ago');
                expect(result).toBe('2024-06-15T10:00:00.000Z');
            });

            it('should parse "30 minutes ago"', () => {
                const result = parseTemporalDate('30 minutes ago');
                expect(result).toBe('2024-06-15T11:30:00.000Z');
            });

            it('should parse "45 seconds ago"', () => {
                const result = parseTemporalDate('45 seconds ago');
                expect(result).toBe('2024-06-15T11:59:15.000Z');
            });

            it('should handle singular "day" without "s"', () => {
                const result = parseTemporalDate('1 day ago');
                expect(result).toBe('2024-06-14T12:00:00.000Z');
            });

            it('should be case insensitive', () => {
                const result = parseTemporalDate('30 DAYS AGO');
                expect(result).toBe('2024-05-16T12:00:00.000Z');
            });
        });

        describe('relative dates - last unit', () => {
            it('should parse "last week"', () => {
                const result = parseTemporalDate('last week');
                expect(result).toBe('2024-06-08T12:00:00.000Z');
            });

            it('should parse "last month"', () => {
                const result = parseTemporalDate('last month');
                expect(result).toBe('2024-05-15T12:00:00.000Z');
            });

            it('should parse "last year"', () => {
                const result = parseTemporalDate('last year');
                expect(result).toBe('2023-06-15T12:00:00.000Z');
            });

            it('should be case insensitive', () => {
                const result = parseTemporalDate('LAST WEEK');
                expect(result).toBe('2024-06-08T12:00:00.000Z');
            });
        });

        describe('invalid or unknown formats', () => {
            it('should return original string for unrecognized format', () => {
                const result = parseTemporalDate('some random string');
                expect(result).toBe('some random string');
            });

            it('should return original string for git-specific formats', () => {
                // Git understands these but our parser doesn't convert them
                const result = parseTemporalDate('2 weeks 3 days ago');
                expect(result).toBe('2 weeks 3 days ago');
            });
        });
    });

    describe('validateDateRange', () => {
        it('should return null for valid date range', () => {
            const error = validateDateRange('2024-01-01', '2024-12-31');
            expect(error).toBeNull();
        });

        it('should return null when only since is provided', () => {
            const error = validateDateRange('2024-01-01', undefined);
            expect(error).toBeNull();
        });

        it('should return null when only until is provided', () => {
            const error = validateDateRange(undefined, '2024-12-31');
            expect(error).toBeNull();
        });

        it('should return null when both are undefined', () => {
            const error = validateDateRange(undefined, undefined);
            expect(error).toBeNull();
        });

        it('should return error when since > until', () => {
            const error = validateDateRange('2024-12-31', '2024-01-01');
            expect(error).toContain('since');
            expect(error).toContain('until');
            expect(error).toContain('before');
        });

        it('should validate relative dates', () => {
            const error = validateDateRange('30 days ago', '1 day ago');
            expect(error).toBeNull();
        });

        it('should return error for invalid relative date range', () => {
            const error = validateDateRange('1 day ago', '30 days ago');
            expect(error).toContain('since');
            expect(error).toContain('until');
        });

        it('should handle mixed ISO and relative dates', () => {
            const error = validateDateRange('2024-01-01', '30 days ago');
            expect(error).toBeNull(); // 2024-01-01 is before 30 days ago
        });

        it('should return null for same date', () => {
            const error = validateDateRange('2024-06-15', '2024-06-15');
            expect(error).toBeNull();
        });
    });

    describe('toDbDate', () => {
        it('should convert ISO date to Date object', () => {
            const result = toDbDate('2024-01-01');
            expect(result).toBeInstanceOf(Date);
            expect(result?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
        });

        it('should convert relative date to Date object', () => {
            const result = toDbDate('30 days ago');
            expect(result).toBeInstanceOf(Date);
            expect(result?.toISOString()).toBe('2024-05-16T12:00:00.000Z');
        });

        it('should return undefined for undefined input', () => {
            const result = toDbDate(undefined);
            expect(result).toBeUndefined();
        });

        it('should return undefined for empty string', () => {
            const result = toDbDate('');
            expect(result).toBeUndefined();
        });

        it('should handle "yesterday"', () => {
            const result = toDbDate('yesterday');
            expect(result).toBeInstanceOf(Date);
            expect(result?.toISOString()).toBe('2024-06-14T12:00:00.000Z');
        });

        it('should handle "last week"', () => {
            const result = toDbDate('last week');
            expect(result).toBeInstanceOf(Date);
            expect(result?.toISOString()).toBe('2024-06-08T12:00:00.000Z');
        });
    });

    describe('toGitDate', () => {
        it('should preserve ISO date format', () => {
            const result = toGitDate('2024-01-01');
            expect(result).toBe('2024-01-01');
        });

        it('should preserve ISO datetime format', () => {
            const result = toGitDate('2024-01-01T12:30:00Z');
            expect(result).toBe('2024-01-01T12:30:00Z');
        });

        it('should preserve "N days ago" format', () => {
            const result = toGitDate('30 days ago');
            expect(result).toBe('30 days ago');
        });

        it('should preserve "yesterday" format', () => {
            const result = toGitDate('yesterday');
            expect(result).toBe('yesterday');
        });

        it('should preserve "last week" format', () => {
            const result = toGitDate('last week');
            expect(result).toBe('last week');
        });

        it('should preserve "last month" format', () => {
            const result = toGitDate('last month');
            expect(result).toBe('last month');
        });

        it('should preserve "last year" format', () => {
            const result = toGitDate('last year');
            expect(result).toBe('last year');
        });

        it('should return undefined for undefined input', () => {
            const result = toGitDate(undefined);
            expect(result).toBeUndefined();
        });

        it('should pass through unrecognized format unchanged', () => {
            // For formats git doesn't natively understand, pass through to git
            const result = toGitDate('some random string');
            expect(result).toBe('some random string');
        });

        it('should preserve relative time formats', () => {
            const result = toGitDate('2 weeks ago');
            expect(result).toBe('2 weeks ago');
        });
    });

    describe('edge cases', () => {
        it('should handle dates at month boundaries', () => {
            vi.setSystemTime(new Date('2024-03-31T12:00:00.000Z'));
            const result = parseTemporalDate('1 month ago');
            // JavaScript Date handles month rollover
            expect(result).toBeDefined();
        });

        it('should handle dates at year boundaries', () => {
            vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
            const result = parseTemporalDate('1 month ago');
            expect(result).toBe('2023-12-15T12:00:00.000Z');
        });

        it('should handle leap year February', () => {
            vi.setSystemTime(new Date('2024-03-01T12:00:00.000Z'));
            const result = parseTemporalDate('1 month ago');
            expect(result).toBe('2024-02-01T12:00:00.000Z');
        });

        it('should handle midnight times', () => {
            vi.setSystemTime(new Date('2024-06-15T00:00:00.000Z'));
            const result = parseTemporalDate('1 day ago');
            expect(result).toBe('2024-06-14T00:00:00.000Z');
        });

        it('should handle end of day times', () => {
            vi.setSystemTime(new Date('2024-06-15T23:59:59.999Z'));
            const result = parseTemporalDate('1 day ago');
            expect(result).toBe('2024-06-14T23:59:59.999Z');
        });
    });

    describe('integration scenarios', () => {
        it('should correctly validate a typical user query range', () => {
            const since = '30 days ago';
            const until = 'yesterday';

            const parsedSince = parseTemporalDate(since);
            const parsedUntil = parseTemporalDate(until);
            const validationError = validateDateRange(since, until);

            expect(parsedSince).toBe('2024-05-16T12:00:00.000Z');
            expect(parsedUntil).toBe('2024-06-14T12:00:00.000Z');
            expect(validationError).toBeNull();
        });

        it('should correctly convert for database queries', () => {
            const since = '7 days ago';
            const until = 'yesterday';

            const dbSince = toDbDate(since);
            const dbUntil = toDbDate(until);

            expect(dbSince).toBeInstanceOf(Date);
            expect(dbUntil).toBeInstanceOf(Date);
            expect(dbSince!.getTime()).toBeLessThan(dbUntil!.getTime());
        });

        it('should correctly preserve for git commands', () => {
            const since = '30 days ago';
            const until = 'yesterday';

            const gitSince = toGitDate(since);
            const gitUntil = toGitDate(until);

            // Git natively understands these, so they're preserved
            expect(gitSince).toBe('30 days ago');
            expect(gitUntil).toBe('yesterday');
        });

        it('should handle mixed ISO and relative dates in range validation', () => {
            const since = '2024-01-01';
            const until = '7 days ago';

            const validationError = validateDateRange(since, until);
            expect(validationError).toBeNull();
        });
    });
});
