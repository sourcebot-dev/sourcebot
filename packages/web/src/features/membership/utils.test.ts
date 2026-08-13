import { beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma } from '@/__mocks__/prisma';
import { UserType } from '@sourcebot/db';

const mocks = vi.hoisted(() => ({
    getSeatCap: vi.fn((): number | undefined => undefined),
    hasEntitlement: vi.fn(async (_entitlement: string) => false),
}));

vi.mock('@/prisma', async () => {
    const actual = await vi.importActual<typeof import('@/__mocks__/prisma')>('@/__mocks__/prisma');
    return { ...actual };
});
vi.mock('@sourcebot/shared', () => ({
    getSeatCap: mocks.getSeatCap,
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: mocks.hasEntitlement,
}));

import { activeMembershipWhere, humanMembershipWhere, orgHasAvailability } from './utils';

const ORG_ID = 1;

beforeEach(() => {
    mocks.getSeatCap.mockReset().mockReturnValue(undefined);
});

describe('humanMembershipWhere', () => {
    test('matches only HUMAN-typed users', () => {
        expect(humanMembershipWhere()).toEqual({ user: { type: UserType.HUMAN } });
    });
});

describe('orgHasAvailability', () => {
    test('has availability when there is no seat cap, regardless of count', async () => {
        prisma.userToOrg.count.mockResolvedValue(1000);

        const result = await orgHasAvailability(ORG_ID, prisma);

        expect(result).toBe(true);
    });

    test('excludes service accounts from the active-seat count', async () => {
        prisma.userToOrg.count.mockResolvedValue(0);

        await orgHasAvailability(ORG_ID, prisma);

        expect(prisma.userToOrg.count).toHaveBeenCalledWith({
            where: {
                orgId: ORG_ID,
                ...activeMembershipWhere(),
                ...humanMembershipWhere(),
            },
        });
    });

    test('is at capacity when the human active count meets the seat cap', async () => {
        mocks.getSeatCap.mockReturnValue(2);
        prisma.userToOrg.count.mockResolvedValue(2);

        const result = await orgHasAvailability(ORG_ID, prisma);

        expect(result).toBe(false);
    });

    test('has availability when the human active count is below the seat cap', async () => {
        mocks.getSeatCap.mockReturnValue(2);
        prisma.userToOrg.count.mockResolvedValue(1);

        const result = await orgHasAvailability(ORG_ID, prisma);

        expect(result).toBe(true);
    });
});
