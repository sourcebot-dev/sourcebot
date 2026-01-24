/**
 * Utilities for parsing and validating date parameters for temporal queries.
 * Supports both absolute (ISO 8601) and relative date formats.
 */

/**
 * Parse a date string that can be either:
 * - ISO 8601 format (e.g., "2024-01-01", "2024-01-01T12:00:00Z")
 * - Relative format (e.g., "30 days ago", "1 week ago", "yesterday", "last week")
 *
 * @param dateStr - The date string to parse
 * @returns ISO 8601 string if successfully parsed, original string if not parseable (to allow git to try), or undefined if input is falsy
 *
 * @example
 * parseTemporalDate('2024-01-01') // '2024-01-01T00:00:00.000Z'
 * parseTemporalDate('30 days ago') // Calculates and returns ISO string
 * parseTemporalDate('yesterday') // Yesterday's date as ISO string
 * parseTemporalDate('some-git-format') // 'some-git-format' (passed through)
 * parseTemporalDate(undefined) // undefined
 */
export function parseTemporalDate(dateStr: string | undefined): string | undefined {
    if (!dateStr) {
        return undefined;
    }

    // Try parsing as ISO date first
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString();
    }

    // Parse relative dates (Git-compatible format)
    // Git accepts these natively, but we normalize to ISO for consistency
    const lowerStr = dateStr.toLowerCase().trim();

    // Handle "yesterday"
    if (lowerStr === 'yesterday') {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date.toISOString();
    }

    // Handle "N <unit>s ago" format
    const matchRelative = lowerStr.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i);
    if (matchRelative) {
        const amount = parseInt(matchRelative[1]);
        const unit = matchRelative[2].toLowerCase();
        const date = new Date();

        switch (unit) {
            case 'second':
                date.setSeconds(date.getSeconds() - amount);
                break;
            case 'minute':
                date.setMinutes(date.getMinutes() - amount);
                break;
            case 'hour':
                date.setHours(date.getHours() - amount);
                break;
            case 'day':
                date.setDate(date.getDate() - amount);
                break;
            case 'week':
                date.setDate(date.getDate() - (amount * 7));
                break;
            case 'month':
                date.setMonth(date.getMonth() - amount);
                break;
            case 'year':
                date.setFullYear(date.getFullYear() - amount);
                break;
        }

        return date.toISOString();
    }

    // Handle "last <unit>" format
    const matchLast = lowerStr.match(/^last\s+(week|month|year)$/i);
    if (matchLast) {
        const unit = matchLast[1].toLowerCase();
        const date = new Date();

        switch (unit) {
            case 'week':
                date.setDate(date.getDate() - 7);
                break;
            case 'month':
                date.setMonth(date.getMonth() - 1);
                break;
            case 'year':
                date.setFullYear(date.getFullYear() - 1);
                break;
        }

        return date.toISOString();
    }

    // If we can't parse it, return the original string
    // This allows git log to try parsing it with its own logic
    return dateStr;
}

/**
 * Validate that a date range is consistent (since < until).
 *
 * @param since - Start date (inclusive)
 * @param until - End date (inclusive)
 * @returns Error message if invalid, null if valid
 */
export function validateDateRange(since: string | undefined, until: string | undefined): string | null {
    if (!since || !until) {
        return null; // No validation needed if either is missing
    }

    const parsedSince = parseTemporalDate(since);
    const parsedUntil = parseTemporalDate(until);

    if (!parsedSince || !parsedUntil) {
        return null; // Let individual date parsing handle invalid formats
    }

    const sinceDate = new Date(parsedSince);
    const untilDate = new Date(parsedUntil);

    if (isNaN(sinceDate.getTime()) || isNaN(untilDate.getTime())) {
        return null;
    }

    if (sinceDate > untilDate) {
        return `Invalid date range: 'since' (${since}) must be before 'until' (${until})`;
    }

    return null;
}

/**
 * Convert a date to a format suitable for Prisma database queries.
 * Returns a Date object or undefined.
 *
 * @param dateStr - The date string to convert
 * @returns Date object or undefined
 */
export function toDbDate(dateStr: string | undefined): Date | undefined {
    if (!dateStr) {
        return undefined;
    }

    const parsed = parseTemporalDate(dateStr);
    if (!parsed) {
        return undefined;
    }

    const date = new Date(parsed);
    return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Convert a date to a format suitable for git log commands.
 * Git accepts relative formats directly, so we preserve them when possible.
 *
 * @param dateStr - The date string to convert
 * @returns Git-compatible date string or undefined
 */
export function toGitDate(dateStr: string | undefined): string | undefined {
    if (!dateStr) {
        return undefined;
    }

    // Git natively understands these formats, so preserve them
    const gitNativeFormats = [
        /^\d+\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i,
        /^yesterday$/i,
        /^last\s+(week|month|year)$/i,
        /^\d{4}-\d{2}-\d{2}$/,  // ISO date
        /^\d{4}-\d{2}-\d{2}T/,  // ISO datetime
    ];

    for (const pattern of gitNativeFormats) {
        if (pattern.test(dateStr)) {
            return dateStr; // Git can handle this directly
        }
    }

    // Otherwise, parse and convert to ISO
    return parseTemporalDate(dateStr);
}
