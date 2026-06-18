/**
 * Pure logic for the offline-license usage report.
 *
 * Buckets an org's seat-usage ledger into subscription-anchored "Months"
 * (each successive one-month period from the subscription start date, per the
 * Order Form's Add-On User terms) and computes, for each Month, the greatest
 * number of provisioned seats at any time during that Month — the figure the
 * customer reports for reconciliation.
 *
 * All boundary math is in UTC so the windows are unambiguous regardless of the
 * deployment's local timezone.
 */

export interface SeatUsageLedgerEntry {
    /** When the seat count changed to `seatCount`. */
    timestamp: Date;
    /** Absolute provisioned-seat count as of `timestamp`. */
    seatCount: number;
}

export interface MonthlyUsage {
    /** 1-based index; Month 1 begins on the subscription start date. */
    monthNumber: number;
    /** Inclusive window start (UTC). */
    windowStart: Date;
    /** Exclusive window end (UTC). */
    windowEnd: Date;
    /** Greatest provisioned-seat count at any time during the window. */
    peakProvisioned: number;
    /** When the peak was first in effect within the window. */
    peakAt: Date;
    /** Provisioned-seat count in effect at the end of the window. */
    endProvisioned: number;
    /** False while the window still extends past `asOf` (Month in progress). */
    isComplete: boolean;
}

/**
 * Adds `k` calendar months to `start` in UTC, clamping the day-of-month to the
 * target month's last day (e.g. Jan 31 + 1 month -> Feb 28/29). This matches
 * the conventional monthly-anniversary semantics for a subscription that starts
 * on a day that doesn't exist in a later month.
 */
const addUtcMonths = (start: Date, k: number): Date => {
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + k;
    const day = start.getUTCDate();

    // Day 0 of the following month is the last day of the target month.
    const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const clampedDay = Math.min(day, lastDayOfTargetMonth);

    return new Date(Date.UTC(
        year,
        month,
        clampedDay,
        start.getUTCHours(),
        start.getUTCMinutes(),
        start.getUTCSeconds(),
        start.getUTCMilliseconds(),
    ));
};

/**
 * Seat count in effect immediately before `t`: the seatCount of the latest
 * event strictly before `t`, or 0 if none exists (i.e. before the ledger has
 * any history for this org).
 *
 * `events` must be sorted ascending by timestamp.
 */
const seatCountBefore = (events: SeatUsageLedgerEntry[], t: Date): number => {
    let value = 0;
    for (const event of events) {
        if (event.timestamp.getTime() < t.getTime()) {
            value = event.seatCount;
        } else {
            break;
        }
    }
    return value;
};

/**
 * Computes per-Month usage from a seat-usage ledger.
 *
 * Produces one entry per subscription Month from `startDate` up to and
 * including the Month containing `asOf`. The in-progress Month (if any) is
 * included with `isComplete: false`.
 *
 * The peak for a Month accounts for the seat count carried into the window from
 * a prior change (a count set in December is still "in effect" through January
 * even with no January events), not just events that occur within the window.
 *
 * NOTE: a Month entirely before the ledger's first event reports 0 — there is
 * no history to derive a count from. In practice the migration backfills a
 * baseline row, so this only affects periods predating that backfill.
 */
export const computeMonthlyUsage = (
    ledger: SeatUsageLedgerEntry[],
    startDate: Date,
    asOf: Date,
): MonthlyUsage[] => {
    const events = [...ledger].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const months: MonthlyUsage[] = [];

    let monthNumber = 1;
    // Each boundary is computed from `startDate` directly (not by repeatedly
    // adding a month) so day-clamping can't accumulate drift across Months.
    let windowStart = startDate;

    while (windowStart.getTime() <= asOf.getTime()) {
        const windowEnd = addUtcMonths(startDate, monthNumber);

        // The count entering the window — the peak is at least this, since it
        // was in effect at the very start of the Month.
        const priorValue = seatCountBefore(events, windowStart);

        let peakProvisioned = priorValue;
        let peakAt = windowStart;

        for (const event of events) {
            const t = event.timestamp.getTime();
            if (t < windowStart.getTime()) {
                continue;
            }
            if (t >= windowEnd.getTime()) {
                break;
            }
            // Strictly greater: keep the earliest moment a given peak is reached.
            if (event.seatCount > peakProvisioned) {
                peakProvisioned = event.seatCount;
                peakAt = event.timestamp;
            }
        }

        months.push({
            monthNumber,
            windowStart,
            windowEnd,
            peakProvisioned,
            peakAt,
            endProvisioned: seatCountBefore(events, windowEnd),
            isComplete: windowEnd.getTime() <= asOf.getTime(),
        });

        windowStart = windowEnd;
        monthNumber += 1;
    }

    return months;
};
