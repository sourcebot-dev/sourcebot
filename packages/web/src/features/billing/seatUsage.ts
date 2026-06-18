import { Prisma } from "@sourcebot/db";

/**
 * Appends a row to the org's seat-usage ledger recording its *current*
 * member count. Call this in the same transaction as any mutation that
 * adds or removes a member, AFTER the mutation has been applied, so the
 * recorded count and the actual membership can never disagree.
 *
 * The count is absolute (not a delta), so peak usage over any period is
 * MAX(seatCount) over the rows in that window. These rows are the source
 * of truth for offline license usage reports.
 *
 * Recording is unconditional: if a mutation turns out to be a no-op (e.g.
 * an upsert of an already-existing member), this writes a row with the
 * same count as the previous one. That duplicate is harmless for a
 * high-water-mark report and keeps the contract simple — every membership
 * code path records, none has to reason about whether the count changed.
 */
export const recordSeatChange = async (
    tx: Prisma.TransactionClient,
    orgId: number,
): Promise<void> => {
    const seatCount = await tx.userToOrg.count({
        where: { orgId },
    });

    await tx.seatUsageEvent.create({
        data: {
            orgId,
            seatCount,
        },
    });
};
