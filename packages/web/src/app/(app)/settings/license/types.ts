import { YearlyTermStatus as RawYearlyTermStatus } from "@/features/billing/types";
import { License } from "@sourcebot/db";

export type YearlyTermStatus = Omit<RawYearlyTermStatus, 'currentQuarterStartedAt' | 'currentQuarterEndsAt' | 'termStartedAt' | 'termEndsAt'> & {
    currentQuarterStartedAt: Date,
    currentQuarterEndsAt: Date,
    termStartedAt: Date,
    termEndsAt: Date,
}

export function getYearlyTermStatus(
    license: License | null,
): YearlyTermStatus | undefined {
    if (
        license === null
        || license.yearlyCommittedSeats === null
        || license.yearlyPeakSeats === null
        || license.yearlyOverageSeats === null
        || license.yearlyBillableOverageSeats === null
        || license.yearlyCurrentQuarterNumber === null
        || license.yearlyTotalQuartersInTerm === null
        || license.yearlyCurrentQuarterStartedAt === null
        || license.yearlyCurrentQuarterEndsAt === null
        || license.yearlyTermStartedAt === null
        || license.yearlyTermEndsAt === null
    ) {
        return undefined;
    }
    return {
        committedSeats: license.yearlyCommittedSeats,
        peakSeats: license.yearlyPeakSeats,
        overageSeats: license.yearlyOverageSeats,
        billableOverageSeats: license.yearlyBillableOverageSeats,
        currentQuarterNumber: license.yearlyCurrentQuarterNumber,
        totalQuartersInTerm: license.yearlyTotalQuartersInTerm,
        currentQuarterStartedAt: license.yearlyCurrentQuarterStartedAt,
        currentQuarterEndsAt: license.yearlyCurrentQuarterEndsAt,
        termStartedAt: license.yearlyTermStartedAt,
        termEndsAt: license.yearlyTermEndsAt,
    };
}