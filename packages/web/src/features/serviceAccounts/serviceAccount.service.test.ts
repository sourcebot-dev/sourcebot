import { beforeEach, describe, expect, test, vi } from 'vitest';
import { prisma, MOCK_SERVICE_ACCOUNT_USER, MOCK_USER_WITH_ACCOUNTS } from '@/__mocks__/prisma';
import { OrgRole, Prisma, UserToOrg, UserType, type User } from '@sourcebot/db';
import { ErrorCode } from '@/lib/errorCodes';
import { isServiceError } from '@/lib/utils';
import type { ServiceError } from '@/lib/serviceError';

const mocks = vi.hoisted(() => ({
    orgHasAvailability: vi.fn(),
    syncWithLighthouse: vi.fn(),
    createAudit: vi.fn(),
    generateApiKey: vi.fn(),
}));

vi.mock('@/prisma', async () => {
    const actual = await vi.importActual<typeof import('@/__mocks__/prisma')>('@/__mocks__/prisma');
    return { ...actual };
});
vi.mock('server-only', () => ({ default: vi.fn() }));
vi.mock('@/features/membership/utils', () => ({
    orgHasAvailability: mocks.orgHasAvailability,
    activeMembershipWhere: () => ({ suspendedAt: null, lastActiveAt: { not: null } }),
    pendingMembershipWhere: () => ({ suspendedAt: null, lastActiveAt: null }),
    humanMembershipWhere: () => ({ user: { type: 'HUMAN' } }),
}));
vi.mock('@/features/billing/servicePing', () => ({ syncWithLighthouse: mocks.syncWithLighthouse }));
vi.mock('@/ee/features/audit/audit', () => ({ createAudit: mocks.createAudit }));
vi.mock('@sourcebot/shared', () => ({ generateApiKey: mocks.generateApiKey }));

import {
    createServiceAccount,
    createServiceAccountApiKey,
    deleteServiceAccountApiKey,
    listServiceAccounts,
    removeServiceAccount,
    setServiceAccountRole,
    suspendServiceAccount,
} from './serviceAccount.service';

const ORG_ID = 1;
const HUMAN_ACTOR = { id: 'human-1', type: 'user' } as const;

const makeMembership = (overrides: Partial<UserToOrg> = {}): UserToOrg => ({
    orgId: ORG_ID,
    userId: MOCK_SERVICE_ACCOUNT_USER.id,
    role: OrgRole.MEMBER,
    joinedAt: new Date(),
    suspendedAt: null,
    scimExternalId: null,
    lastActiveAt: new Date(),
    ...overrides,
});

type MembershipWithUser = Prisma.UserToOrgGetPayload<{ include: { user: true } }>;

const makeMembershipWithUser = (user: User, overrides: Partial<UserToOrg> = {}): MembershipWithUser => ({
    ...makeMembership({ userId: user.id, ...overrides }),
    user,
});

beforeEach(() => {
    mocks.orgHasAvailability.mockReset().mockResolvedValue(true);
    mocks.syncWithLighthouse.mockReset().mockResolvedValue(undefined);
    mocks.createAudit.mockReset().mockResolvedValue(undefined);
    mocks.generateApiKey.mockReset().mockReturnValue({ key: 'sbk_secret', hash: 'hash-1' });
    // Run $transaction callbacks against the same deep mock as the tx client.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(prisma));
});

describe('createServiceAccount', () => {
    test('creates a SERVICE-typed user with an immediately active membership and no seat check', async () => {
        prisma.user.create.mockResolvedValue(MOCK_SERVICE_ACCOUNT_USER);
        prisma.userToOrg.create.mockResolvedValue(makeMembership());

        const result = await createServiceAccount(ORG_ID, {
            actor: HUMAN_ACTOR,
            name: 'CI Pipeline',
            role: OrgRole.MEMBER,
        });

        expect(isServiceError(result)).toBe(false);
        expect(prisma.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    type: UserType.SERVICE,
                    name: 'CI Pipeline',
                    createdById: HUMAN_ACTOR.id,
                }),
            }),
        );
        expect(prisma.userToOrg.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    orgId: ORG_ID,
                    role: OrgRole.MEMBER,
                    lastActiveAt: expect.any(Date),
                }),
            }),
        );
        // No seat-cap gate for service accounts.
        expect(mocks.orgHasAvailability).not.toHaveBeenCalled();
        expect(mocks.createAudit).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'service_account.created', target: { id: MOCK_SERVICE_ACCOUNT_USER.id, type: 'service_account' } }),
        );
    });

    test("synthesizes a non-user-facing email, never using the caller's input", async () => {
        prisma.user.create.mockResolvedValue(MOCK_SERVICE_ACCOUNT_USER);
        prisma.userToOrg.create.mockResolvedValue(makeMembership());

        await createServiceAccount(ORG_ID, { actor: HUMAN_ACTOR, name: 'CI Pipeline', role: OrgRole.MEMBER });

        const createCall = prisma.user.create.mock.calls[0]?.[0];
        expect(createCall.data.email).toMatch(/^svc\+.+@service\.internal$/);
    });
});

describe('setServiceAccountRole / suspendServiceAccount / removeServiceAccount guards', () => {
    test('rejects operating on a HUMAN-typed id', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembershipWithUser(MOCK_USER_WITH_ACCOUNTS));

        const roleResult = await setServiceAccountRole(ORG_ID, MOCK_USER_WITH_ACCOUNTS.id, OrgRole.OWNER, { actor: HUMAN_ACTOR });
        const suspendResult = await suspendServiceAccount(ORG_ID, MOCK_USER_WITH_ACCOUNTS.id, { actor: HUMAN_ACTOR });
        const removeResult = await removeServiceAccount(ORG_ID, MOCK_USER_WITH_ACCOUNTS.id, { actor: HUMAN_ACTOR });

        for (const result of [roleResult, suspendResult, removeResult]) {
            expect(isServiceError(result)).toBe(true);
            expect((result as ServiceError).errorCode).toBe(ErrorCode.SERVICE_ACCOUNT_NOT_FOUND);
        }
        expect(prisma.userToOrg.delete).not.toHaveBeenCalled();
        expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    test('rejects an id that has no membership in this org', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(null);

        const result = await suspendServiceAccount(ORG_ID, 'nonexistent', { actor: HUMAN_ACTOR });

        expect(isServiceError(result)).toBe(true);
        expect((result as ServiceError).errorCode).toBe(ErrorCode.SERVICE_ACCOUNT_NOT_FOUND);
    });
});

describe('suspendServiceAccount', () => {
    test('revokes all of its API keys and OAuth credentials via the shared membership suspension path', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembershipWithUser(MOCK_SERVICE_ACCOUNT_USER, { suspendedAt: null }));
        prisma.userToOrg.update.mockResolvedValue(makeMembership({ suspendedAt: new Date() }));

        const result = await suspendServiceAccount(ORG_ID, MOCK_SERVICE_ACCOUNT_USER.id, { actor: HUMAN_ACTOR });

        expect(isServiceError(result)).toBe(false);
        expect(prisma.apiKey.deleteMany).toHaveBeenCalledWith({
            where: { createdById: MOCK_SERVICE_ACCOUNT_USER.id, orgId: ORG_ID },
        });
        expect(mocks.createAudit).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'org.member_deactivated', target: { id: MOCK_SERVICE_ACCOUNT_USER.id, type: 'service_account' } }),
        );
    });
});

describe('removeServiceAccount', () => {
    test('hard-deletes the User row after removing its membership', async () => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembershipWithUser(MOCK_SERVICE_ACCOUNT_USER));

        const result = await removeServiceAccount(ORG_ID, MOCK_SERVICE_ACCOUNT_USER.id, { actor: HUMAN_ACTOR });

        expect(result).toBeNull();
        expect(prisma.userToOrg.delete).toHaveBeenCalledWith({
            where: { orgId_userId: { orgId: ORG_ID, userId: MOCK_SERVICE_ACCOUNT_USER.id } },
        });
        expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: MOCK_SERVICE_ACCOUNT_USER.id } });
        expect(mocks.createAudit).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'service_account.removed', target: { id: MOCK_SERVICE_ACCOUNT_USER.id, type: 'service_account' } }),
        );
    });

    test('blocks removing the last active owner even when it is a service account', async () => {
        prisma.userToOrg.findUnique.mockResolvedValueOnce(makeMembershipWithUser(MOCK_SERVICE_ACCOUNT_USER, { role: OrgRole.OWNER, suspendedAt: null }));
        // membership.service.removeMember's own lookup (second call inside the transaction).
        prisma.userToOrg.findUnique.mockResolvedValueOnce(makeMembership({ role: OrgRole.OWNER, suspendedAt: null }));
        prisma.userToOrg.count.mockResolvedValue(1);

        const result = await removeServiceAccount(ORG_ID, MOCK_SERVICE_ACCOUNT_USER.id, { actor: HUMAN_ACTOR });

        expect(isServiceError(result)).toBe(true);
        expect((result as ServiceError).errorCode).toBe(ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED);
        expect(prisma.user.delete).not.toHaveBeenCalled();
    });
});

describe('service account API key management', () => {
    beforeEach(() => {
        prisma.userToOrg.findUnique.mockResolvedValue(makeMembershipWithUser(MOCK_SERVICE_ACCOUNT_USER));
    });

    test('creates a key scoped to the service account, not the calling human', async () => {
        prisma.apiKey.findFirst.mockResolvedValue(null);
        prisma.apiKey.create.mockResolvedValue({
            name: 'ci-key',
            hash: 'hash-1',
            createdAt: new Date(),
            lastUsedAt: null,
            orgId: ORG_ID,
            createdById: MOCK_SERVICE_ACCOUNT_USER.id,
        });

        const result = await createServiceAccountApiKey(ORG_ID, MOCK_SERVICE_ACCOUNT_USER.id, 'ci-key', { actor: HUMAN_ACTOR });

        expect(isServiceError(result)).toBe(false);
        expect(prisma.apiKey.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ createdById: MOCK_SERVICE_ACCOUNT_USER.id }) }),
        );
        expect(mocks.createAudit).toHaveBeenCalledWith(
            expect.objectContaining({ actor: HUMAN_ACTOR, action: 'api_key.created' }),
        );
    });

    test('rejects a duplicate key name for the same service account', async () => {
        prisma.apiKey.findFirst.mockResolvedValue({
            name: 'ci-key',
            hash: 'existing',
            createdAt: new Date(),
            lastUsedAt: null,
            orgId: ORG_ID,
            createdById: MOCK_SERVICE_ACCOUNT_USER.id,
        });

        const result = await createServiceAccountApiKey(ORG_ID, MOCK_SERVICE_ACCOUNT_USER.id, 'ci-key', { actor: HUMAN_ACTOR });

        expect(isServiceError(result)).toBe(true);
        expect((result as ServiceError).errorCode).toBe(ErrorCode.API_KEY_ALREADY_EXISTS);
        expect(prisma.apiKey.create).not.toHaveBeenCalled();
    });

    test('deletes a key scoped to the service account', async () => {
        prisma.apiKey.findFirst.mockResolvedValue({
            name: 'ci-key',
            hash: 'hash-1',
            createdAt: new Date(),
            lastUsedAt: null,
            orgId: ORG_ID,
            createdById: MOCK_SERVICE_ACCOUNT_USER.id,
        });

        const result = await deleteServiceAccountApiKey(ORG_ID, MOCK_SERVICE_ACCOUNT_USER.id, 'ci-key', { actor: HUMAN_ACTOR });

        expect(isServiceError(result)).toBe(false);
        expect(prisma.apiKey.delete).toHaveBeenCalledWith({ where: { hash: 'hash-1' } });
    });
});

describe('listServiceAccounts', () => {
    test('lists only SERVICE-typed memberships for the org', async () => {
        prisma.userToOrg.findMany.mockResolvedValue([makeMembershipWithUser(MOCK_SERVICE_ACCOUNT_USER)]);

        const result = await listServiceAccounts(ORG_ID);

        expect(prisma.userToOrg.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { orgId: ORG_ID, user: { type: UserType.SERVICE } },
            }),
        );
        expect(result).toEqual([
            expect.objectContaining({ id: MOCK_SERVICE_ACCOUNT_USER.id, name: MOCK_SERVICE_ACCOUNT_USER.name }),
        ]);
    });
});
