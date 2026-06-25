import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ensureActiveMember, removeMember, setMemberRole, setMembershipSuspended } from './membership.service';
import { prisma, MOCK_USER_WITH_ACCOUNTS } from '@/__mocks__/prisma';
import { OrgRole, type UserToOrg } from '@sourcebot/db';
import { ErrorCode } from '@/lib/errorCodes';
import { isServiceError } from '@/lib/utils';
import type { ServiceError } from '@/lib/serviceError';

const mocks = vi.hoisted(() => ({
    orgHasAvailability: vi.fn(),
    syncWithLighthouse: vi.fn(),
    createAudit: vi.fn(),
}));

vi.mock('@/prisma', async () => {
    const actual = await vi.importActual<typeof import('@/__mocks__/prisma')>('@/__mocks__/prisma');
    return { ...actual };
});
vi.mock('server-only', () => ({ default: vi.fn() }));
vi.mock('@/features/membership/utils', () => ({
    orgHasAvailability: mocks.orgHasAvailability,
    unsuspendedMembershipWhere: () => ({ suspendedAt: null }),
}));
vi.mock('@/features/billing/servicePing', () => ({ syncWithLighthouse: mocks.syncWithLighthouse }));
vi.mock('@/ee/features/audit/audit', () => ({ createAudit: mocks.createAudit }));

const ORG_ID = 1;
const USER_ID = 'user-1';
const ACTOR = { id: 'scim', type: 'scim_token' } as const;
const SUSPENDED_AT = new Date('2026-01-01T00:00:00.000Z');

const makeMembership = (overrides: Partial<UserToOrg> = {}): UserToOrg => ({
    orgId: ORG_ID,
    userId: USER_ID,
    role: OrgRole.MEMBER,
    joinedAt: new Date(),
    suspendedAt: null,
    scimExternalId: null,
    lastActiveAt: null,
    ...overrides,
});

const mockUser = { ...MOCK_USER_WITH_ACCOUNTS, id: USER_ID, email: 'user@example.com' };

beforeEach(() => {
    mocks.orgHasAvailability.mockReset().mockResolvedValue(true);
    mocks.syncWithLighthouse.mockReset().mockResolvedValue(undefined);
    mocks.createAudit.mockReset().mockResolvedValue(undefined);
    // Run $transaction callbacks against the same deep mock as the tx client.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(prisma));
});

describe('ensureActiveMember', () => {
    test('creates a new active membership when none exists', async () => {
        const created = makeMembership();
        prisma.user.findUnique.mockResolvedValue(mockUser);
        prisma.userToOrg.findUnique.mockResolvedValue(null);
        prisma.userToOrg.create.mockResolvedValue(created);

        const result = await ensureActiveMember(ORG_ID, USER_ID, { actor: ACTOR, role: OrgRole.MEMBER });

        expect(isServiceError(result)).toBe(false);
        expect(result).toEqual(created);
        expect(prisma.userToOrg.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ userId: USER_ID, orgId: ORG_ID, role: OrgRole.MEMBER }),
            }),
        );
        expect(mocks.syncWithLighthouse).toHaveBeenCalledWith(ORG_ID);
        expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'org.member_added' }));
    });

    test('records scimExternalId on create when provided', async () => {
        prisma.user.findUnique.mockResolvedValue(mockUser);
        prisma.userToOrg.findUnique.mockResolvedValue(null);
        prisma.userToOrg.create.mockResolvedValue(makeMembership({ scimExternalId: 'ext-1' }));

        await ensureActiveMember(ORG_ID, USER_ID, { actor: ACTOR, role: OrgRole.MEMBER, scimExternalId: 'ext-1' });

        expect(prisma.userToOrg.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ scimExternalId: 'ext-1' }) }),
        );
    });

    test('clears pending invites and account requests on create', async () => {
        prisma.user.findUnique.mockResolvedValue(mockUser);
        prisma.userToOrg.findUnique.mockResolvedValue(null);
        prisma.userToOrg.create.mockResolvedValue(makeMembership());

        await ensureActiveMember(ORG_ID, USER_ID, { actor: ACTOR, role: OrgRole.MEMBER });

        expect(prisma.accountRequest.deleteMany).toHaveBeenCalledWith({ where: { requestedById: USER_ID, orgId: ORG_ID } });
        expect(prisma.invite.deleteMany).toHaveBeenCalledWith({ where: { recipientEmail: mockUser.email, orgId: ORG_ID } });
    });

    test('is an idempotent no-op when an unsuspended membership already exists', async () => {
        const existing = makeMembership({ suspendedAt: null });
        prisma.user.findUnique.mockResolvedValue(mockUser);
        prisma.userToOrg.findUnique.mockResolvedValue(existing);

        const result = await ensureActiveMember(ORG_ID, USER_ID, { actor: ACTOR, role: OrgRole.MEMBER });

        expect(result).toEqual(existing);
        expect(prisma.userToOrg.create).not.toHaveBeenCalled();
        expect(mocks.createAudit).not.toHaveBeenCalled();
    });

    test('reactivates a suspended membership', async () => {
        const existing = makeMembership({ suspendedAt: SUSPENDED_AT });
        const reactivated = makeMembership({ suspendedAt: null });
        prisma.user.findUnique.mockResolvedValue(mockUser);
        prisma.userToOrg.findUnique.mockResolvedValue(existing);
        prisma.userToOrg.update.mockResolvedValue(reactivated);
        mocks.orgHasAvailability.mockResolvedValue(true);

        const result = await ensureActiveMember(ORG_ID, USER_ID, { actor: ACTOR, role: OrgRole.MEMBER });

        expect(isServiceError(result)).toBe(false);
        expect(result).toEqual(reactivated);
        expect(prisma.userToOrg.create).not.toHaveBeenCalled();
        expect(prisma.userToOrg.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ suspendedAt: null }) }),
        );
        expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'org.member_reactivated' }));
    });

    test('errors when the org is at seat capacity', async () => {
        prisma.user.findUnique.mockResolvedValue(mockUser);
        prisma.userToOrg.findUnique.mockResolvedValue(null);
        mocks.orgHasAvailability.mockResolvedValue(false);

        const result = await ensureActiveMember(ORG_ID, USER_ID, { actor: ACTOR, role: OrgRole.MEMBER });

        expect(isServiceError(result)).toBe(true);
        expect((result as ServiceError).errorCode).toBe(ErrorCode.ORG_SEAT_COUNT_REACHED);
        expect(prisma.userToOrg.create).not.toHaveBeenCalled();
    });

    test('errors when the user does not exist', async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        const result = await ensureActiveMember(ORG_ID, USER_ID, { actor: ACTOR, role: OrgRole.MEMBER });

        expect(isServiceError(result)).toBe(true);
        expect(prisma.userToOrg.create).not.toHaveBeenCalled();
    });
});

describe('removeMember', () => {
    test('deletes the membership and revokes sessions + tokens', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembership());

        const result = await removeMember(ORG_ID, USER_ID, { actor: ACTOR });

        expect(result).toBeNull();
        expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: USER_ID }, data: { sessionVersion: { increment: 1 } } });
        expect(prisma.apiKey.deleteMany).toHaveBeenCalledWith({ where: { createdById: USER_ID, orgId: ORG_ID } });
        expect(prisma.oAuthToken.deleteMany).toHaveBeenCalled();
        expect(prisma.userToOrg.delete).toHaveBeenCalledWith({ where: { orgId_userId: { orgId: ORG_ID, userId: USER_ID } } });
        expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'org.member_removed' }));
    });

    test('errors when the membership does not exist', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(null);

        const result = await removeMember(ORG_ID, USER_ID, { actor: ACTOR });

        expect(isServiceError(result)).toBe(true);
        expect(prisma.userToOrg.delete).not.toHaveBeenCalled();
    });

    test('blocks removing the last active owner', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembership({ role: OrgRole.OWNER, suspendedAt: null }));
        prisma.userToOrg.count.mockResolvedValue(1);

        const result = await removeMember(ORG_ID, USER_ID, { actor: ACTOR });

        expect(isServiceError(result)).toBe(true);
        expect((result as ServiceError).errorCode).toBe(ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED);
        expect(prisma.userToOrg.delete).not.toHaveBeenCalled();
    });

    test('allows removing an owner when others remain', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembership({ role: OrgRole.OWNER, suspendedAt: null }));
        prisma.userToOrg.count.mockResolvedValue(2);

        const result = await removeMember(ORG_ID, USER_ID, { actor: ACTOR });

        expect(result).toBeNull();
        expect(prisma.userToOrg.delete).toHaveBeenCalled();
    });

    test('reason "left" audits org.member_left', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembership());

        const result = await removeMember(ORG_ID, USER_ID, { actor: ACTOR, reason: 'left' });

        expect(result).toBeNull();
        expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'org.member_left' }));
    });
});

describe('setMemberRole', () => {
    test('promotes a member to owner and audits it', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembership({ role: OrgRole.MEMBER }));

        const result = await setMemberRole(ORG_ID, USER_ID, OrgRole.OWNER, { actor: ACTOR });

        expect(result).toBeNull();
        expect(prisma.userToOrg.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { role: OrgRole.OWNER } }),
        );
        expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'org.member_promoted_to_owner' }));
    });

    test('demotes an owner to member when other owners remain', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembership({ role: OrgRole.OWNER, suspendedAt: null }));
        prisma.userToOrg.count.mockResolvedValue(2);

        const result = await setMemberRole(ORG_ID, USER_ID, OrgRole.MEMBER, { actor: ACTOR });

        expect(result).toBeNull();
        expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'org.owner_demoted_to_member' }));
    });

    test('blocks demoting the last active owner', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembership({ role: OrgRole.OWNER, suspendedAt: null }));
        prisma.userToOrg.count.mockResolvedValue(1);

        const result = await setMemberRole(ORG_ID, USER_ID, OrgRole.MEMBER, { actor: ACTOR });

        expect(isServiceError(result)).toBe(true);
        expect((result as ServiceError).errorCode).toBe(ErrorCode.LAST_OWNER_CANNOT_BE_DEMOTED);
        expect(prisma.userToOrg.update).not.toHaveBeenCalled();
    });

    test('is a no-op when the role is unchanged', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembership({ role: OrgRole.MEMBER }));

        const result = await setMemberRole(ORG_ID, USER_ID, OrgRole.MEMBER, { actor: ACTOR });

        expect(result).toBeNull();
        expect(prisma.userToOrg.update).not.toHaveBeenCalled();
        expect(mocks.createAudit).not.toHaveBeenCalled();
    });

    test('errors when the membership does not exist', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(null);

        const result = await setMemberRole(ORG_ID, USER_ID, OrgRole.OWNER, { actor: ACTOR });

        expect(isServiceError(result)).toBe(true);
        expect(prisma.userToOrg.update).not.toHaveBeenCalled();
    });
});

describe('setMembershipSuspended', () => {
    describe('suspend', () => {
        test('suspends an active member and revokes access', async () => {
            const suspended = makeMembership({ suspendedAt: SUSPENDED_AT });
            prisma.userToOrg.findUnique.mockResolvedValue(makeMembership({ suspendedAt: null }));
            prisma.userToOrg.update.mockResolvedValue(suspended);

            const result = await setMembershipSuspended(ORG_ID, USER_ID, true, { actor: ACTOR });

            expect(result).toEqual(suspended);
            expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: USER_ID }, data: { sessionVersion: { increment: 1 } } });
            expect(prisma.apiKey.deleteMany).toHaveBeenCalledWith({ where: { createdById: USER_ID, orgId: ORG_ID } });
            expect(prisma.oAuthToken.deleteMany).toHaveBeenCalled();
            expect(prisma.userToOrg.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { suspendedAt: expect.any(Date) } }),
            );
            expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'org.member_deactivated' }));
        });

        test('is a no-op when already suspended', async () => {
            const existing = makeMembership({ suspendedAt: SUSPENDED_AT });
            prisma.userToOrg.findUnique.mockResolvedValue(existing);

            const result = await setMembershipSuspended(ORG_ID, USER_ID, true, { actor: ACTOR });

            expect(result).toEqual(existing);
            expect(prisma.userToOrg.update).not.toHaveBeenCalled();
            expect(prisma.user.update).not.toHaveBeenCalled();
            expect(mocks.createAudit).not.toHaveBeenCalled();
        });

        test('errors when the membership does not exist', async () => {
            prisma.userToOrg.findUnique.mockResolvedValue(null);

            const result = await setMembershipSuspended(ORG_ID, USER_ID, true, { actor: ACTOR });

            expect(isServiceError(result)).toBe(true);
            expect(prisma.userToOrg.update).not.toHaveBeenCalled();
        });
    });

    describe('reactivate', () => {
        test('reactivates a suspended member when a seat is available', async () => {
            const reactivated = makeMembership({ suspendedAt: null, scimExternalId: 'ext-1' });
            prisma.userToOrg.findUnique.mockResolvedValue(makeMembership({ suspendedAt: SUSPENDED_AT }));
            prisma.userToOrg.update.mockResolvedValue(reactivated);
            mocks.orgHasAvailability.mockResolvedValue(true);

            const result = await setMembershipSuspended(ORG_ID, USER_ID, false, { actor: ACTOR, scimExternalId: 'ext-1' });

            expect(result).toEqual(reactivated);
            expect(prisma.userToOrg.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ suspendedAt: null, scimExternalId: 'ext-1' }) }),
            );
            expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'org.member_reactivated' }));
        });

        test('errors when the org is at seat capacity', async () => {
            prisma.userToOrg.findUnique.mockResolvedValue(makeMembership({ suspendedAt: SUSPENDED_AT }));
            mocks.orgHasAvailability.mockResolvedValue(false);

            const result = await setMembershipSuspended(ORG_ID, USER_ID, false, { actor: ACTOR });

            expect(isServiceError(result)).toBe(true);
            expect((result as ServiceError).errorCode).toBe(ErrorCode.ORG_SEAT_COUNT_REACHED);
            expect(prisma.userToOrg.update).not.toHaveBeenCalled();
        });

        test('is a no-op when already active (no audit, no seat check)', async () => {
            const existing = makeMembership({ suspendedAt: null, scimExternalId: 'ext-1' });
            prisma.userToOrg.findUnique.mockResolvedValue(existing);

            const result = await setMembershipSuspended(ORG_ID, USER_ID, false, { actor: ACTOR, scimExternalId: 'ext-1' });

            expect(result).toEqual(existing);
            expect(prisma.userToOrg.update).not.toHaveBeenCalled();
            expect(mocks.orgHasAvailability).not.toHaveBeenCalled();
            expect(mocks.createAudit).not.toHaveBeenCalled();
        });

        test('refreshes externalId when already active and it changed', async () => {
            const refreshed = makeMembership({ suspendedAt: null, scimExternalId: 'new' });
            prisma.userToOrg.findUnique.mockResolvedValue(makeMembership({ suspendedAt: null, scimExternalId: 'old' }));
            prisma.userToOrg.update.mockResolvedValue(refreshed);

            const result = await setMembershipSuspended(ORG_ID, USER_ID, false, { actor: ACTOR, scimExternalId: 'new' });

            expect(result).toEqual(refreshed);
            expect(prisma.userToOrg.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { scimExternalId: 'new' } }),
            );
            expect(mocks.createAudit).not.toHaveBeenCalled();
        });
    });
});
