// Shared color ramp for the age-of-commit indicator. Used by the blame gutter
// (left border of each cell) and the legend rendered next to the toolbar.
//
// Tailwind's JIT scanner reads class names from source, so each class must
// appear as a complete literal string. Don't try to construct these via
// template strings.

export const BLAME_AGE_BUCKET_COUNT = 10;

// In dark mode the ramp is flipped: pale shades (amber-50/100) are
// high-contrast against a dark background, dark shades blend in. We want
// "newer" to pop visually in both themes, so the dark-mode bucket-0 (oldest)
// is amber-900 (low contrast → fades) and dark-mode bucket-9 (newest) is
// amber-50 (high contrast → pops). The light-mode ramp stays unchanged.
export const BLAME_AGE_BG_CLASSES = [
    'bg-slate-50 dark:bg-slate-900',
    'bg-slate-100 dark:bg-slate-800',
    'bg-slate-200 dark:bg-slate-700',
    'bg-slate-300 dark:bg-slate-600',
    'bg-slate-400 dark:bg-slate-500',
    'bg-slate-500 dark:bg-slate-400',
    'bg-slate-600 dark:bg-slate-300',
    'bg-slate-700 dark:bg-slate-200',
    'bg-slate-800 dark:bg-slate-100',
    'bg-slate-900 dark:bg-slate-50',
] as const;

/**
 * Linear time mapping: given a commit date (ISO 8601) and the file's overall
 * date range, returns a bucket 0..9 (palest..darkest). Clamps out-of-range
 * inputs (e.g., clock-skewed future dates) to the endpoints.
 */
export const computeAgeBucket = (
    isoDate: string,
    oldestMs: number,
    newestMs: number,
): number => {
    const max = BLAME_AGE_BUCKET_COUNT - 1;
    if (newestMs === oldestMs) {
        return max;
    }
    const t = new Date(isoDate).getTime();
    const ratio = (t - oldestMs) / (newestMs - oldestMs);
    const bucket = Math.floor(ratio * max);
    return Math.max(0, Math.min(max, bucket));
};
