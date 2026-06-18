import { describe, expect, test } from 'vitest';
import { computeMonthlyUsage, SeatUsageLedgerEntry } from './seatUsageReport';

const d = (iso: string) => new Date(iso);
const entry = (iso: string, seatCount: number): SeatUsageLedgerEntry => ({
    timestamp: d(iso),
    seatCount,
});

describe('computeMonthlyUsage', () => {
    test('headline case: peak mid-month above the end-of-month count', () => {
        // Start Jan 1 with 10, grow to 15 on the 18th, drop to 9 on the 25th.
        const ledger = [
            entry('2026-01-01T00:00:00Z', 10),
            entry('2026-01-18T12:00:00Z', 15),
            entry('2026-01-25T08:00:00Z', 9),
        ];

        const [jan] = computeMonthlyUsage(ledger, d('2026-01-01T00:00:00Z'), d('2026-01-31T00:00:00Z'));

        expect(jan.monthNumber).toBe(1);
        expect(jan.windowStart).toEqual(d('2026-01-01T00:00:00Z'));
        expect(jan.windowEnd).toEqual(d('2026-02-01T00:00:00Z'));
        expect(jan.peakProvisioned).toBe(15);
        expect(jan.peakAt).toEqual(d('2026-01-18T12:00:00Z'));
        expect(jan.endProvisioned).toBe(9);
    });

    test('carries the count into a Month with no events of its own', () => {
        // Only January has events; February should inherit January's ending 9.
        const ledger = [
            entry('2026-01-01T00:00:00Z', 10),
            entry('2026-01-25T08:00:00Z', 9),
        ];

        const months = computeMonthlyUsage(ledger, d('2026-01-01T00:00:00Z'), d('2026-02-15T00:00:00Z'));

        const feb = months.find((m) => m.monthNumber === 2)!;
        expect(feb.peakProvisioned).toBe(9);
        // The peak was already in effect at the window start, so peakAt is the start.
        expect(feb.peakAt).toEqual(d('2026-02-01T00:00:00Z'));
        expect(feb.endProvisioned).toBe(9);
    });

    test('a prior-period high carried into the window is the peak', () => {
        const ledger = [
            entry('2026-01-10T00:00:00Z', 20),
            entry('2026-02-05T00:00:00Z', 12), // drops inside February
        ];

        const feb = computeMonthlyUsage(ledger, d('2026-01-01T00:00:00Z'), d('2026-02-28T00:00:00Z'))
            .find((m) => m.monthNumber === 2)!;

        // 20 was in effect at the Feb 1 start, before dropping to 12 on the 5th.
        expect(feb.peakProvisioned).toBe(20);
        expect(feb.peakAt).toEqual(d('2026-02-01T00:00:00Z'));
        expect(feb.endProvisioned).toBe(12);
    });

    test('Months are anchored to the start date, not the calendar', () => {
        // Subscription starts on the 15th: Month 1 is Jan 15 - Feb 14.
        const ledger = [
            entry('2026-01-15T00:00:00Z', 5),
            entry('2026-02-10T00:00:00Z', 8), // still inside Month 1
            entry('2026-02-20T00:00:00Z', 12), // inside Month 2
        ];

        const months = computeMonthlyUsage(ledger, d('2026-01-15T00:00:00Z'), d('2026-03-01T00:00:00Z'));

        const m1 = months[0];
        expect(m1.windowStart).toEqual(d('2026-01-15T00:00:00Z'));
        expect(m1.windowEnd).toEqual(d('2026-02-15T00:00:00Z'));
        expect(m1.peakProvisioned).toBe(8); // the Feb 10 bump falls in Month 1

        const m2 = months[1];
        expect(m2.windowStart).toEqual(d('2026-02-15T00:00:00Z'));
        expect(m2.peakProvisioned).toBe(12); // the Feb 20 bump falls in Month 2
        expect(m2.peakAt).toEqual(d('2026-02-20T00:00:00Z'));
    });

    test('clamps day-of-month when the start day overflows a shorter month', () => {
        // Start Jan 31: Month 1 ends Feb 28 (2026 is not a leap year).
        const ledger = [entry('2026-01-31T00:00:00Z', 3)];

        const months = computeMonthlyUsage(ledger, d('2026-01-31T00:00:00Z'), d('2026-03-31T00:00:00Z'));

        expect(months[0].windowStart).toEqual(d('2026-01-31T00:00:00Z'));
        expect(months[0].windowEnd).toEqual(d('2026-02-28T00:00:00Z'));
        // Month 2 runs Feb 28 -> Mar 31 (the anchor day returns once the month is long enough).
        expect(months[1].windowStart).toEqual(d('2026-02-28T00:00:00Z'));
        expect(months[1].windowEnd).toEqual(d('2026-03-31T00:00:00Z'));
    });

    test('flags the in-progress Month as incomplete', () => {
        const ledger = [entry('2026-01-01T00:00:00Z', 4)];

        // asOf falls inside Month 2.
        const months = computeMonthlyUsage(ledger, d('2026-01-01T00:00:00Z'), d('2026-02-10T00:00:00Z'));

        expect(months).toHaveLength(2);
        expect(months[0].isComplete).toBe(true);
        expect(months[1].isComplete).toBe(false);
    });

    test('does not generate Months beyond the one containing asOf', () => {
        const ledger = [entry('2026-01-01T00:00:00Z', 4)];
        const months = computeMonthlyUsage(ledger, d('2026-01-01T00:00:00Z'), d('2026-01-15T00:00:00Z'));
        expect(months).toHaveLength(1);
    });

    test('treats events exactly on the boundary as belonging to the new Month', () => {
        const ledger = [
            entry('2026-01-05T00:00:00Z', 10),
            entry('2026-02-01T00:00:00Z', 20), // exactly on the Month 1/2 boundary
        ];

        const months = computeMonthlyUsage(ledger, d('2026-01-01T00:00:00Z'), d('2026-02-15T00:00:00Z'));

        // The boundary event is excluded from Month 1 (window end is exclusive)...
        expect(months[0].peakProvisioned).toBe(10);
        // ...and included in Month 2.
        expect(months[1].peakProvisioned).toBe(20);
        expect(months[1].peakAt).toEqual(d('2026-02-01T00:00:00Z'));
    });

    test('reports 0 for a Month entirely before any ledger history', () => {
        // Subscription started Jan 1 but the ledger only begins (backfill) Feb 10.
        const ledger = [entry('2026-02-10T00:00:00Z', 7)];

        const months = computeMonthlyUsage(ledger, d('2026-01-01T00:00:00Z'), d('2026-02-28T00:00:00Z'));

        expect(months[0].peakProvisioned).toBe(0);
        expect(months[1].peakProvisioned).toBe(7);
    });

    test('empty ledger yields zero-seat Months', () => {
        const months = computeMonthlyUsage([], d('2026-01-01T00:00:00Z'), d('2026-01-20T00:00:00Z'));
        expect(months).toHaveLength(1);
        expect(months[0].peakProvisioned).toBe(0);
        expect(months[0].endProvisioned).toBe(0);
    });
});
