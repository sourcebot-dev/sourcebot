import { beforeEach, describe, expect, test, vi } from "vitest";
import { OrgRole } from "@sourcebot/db";
import { ErrorCode } from "@/lib/errorCodes";
import { isServiceError } from "@/lib/utils";
import type { ServiceError } from "@/lib/serviceError";

const MOCK_ORG = { id: 1 };
const MOCK_USER = { id: "human-1", type: "HUMAN" };

const mocks = vi.hoisted(() => ({
    role: undefined as unknown,
    createServiceAccount: vi.fn(),
    updateServiceAccount: vi.fn(),
    setServiceAccountRole: vi.fn(),
    suspendServiceAccount: vi.fn(),
    reactivateServiceAccount: vi.fn(),
    removeServiceAccount: vi.fn(),
    listServiceAccounts: vi.fn(),
    createServiceAccountApiKey: vi.fn(),
    deleteServiceAccountApiKey: vi.fn(),
    getServiceAccountApiKeys: vi.fn(),
}));

vi.mock("@/middleware/withAuth", () => ({
    withAuth: vi.fn((callback: (context: unknown) => unknown) => callback({
        org: MOCK_ORG,
        user: MOCK_USER,
        role: mocks.role,
        prisma: {},
    })),
}));

vi.mock("@/ee/features/audit/utils", () => ({
    auditActorForUser: (user: { id: string }) => ({ id: user.id, type: "user" }),
}));

vi.mock("./serviceAccount.service", () => ({
    createServiceAccount: mocks.createServiceAccount,
    updateServiceAccount: mocks.updateServiceAccount,
    setServiceAccountRole: mocks.setServiceAccountRole,
    suspendServiceAccount: mocks.suspendServiceAccount,
    reactivateServiceAccount: mocks.reactivateServiceAccount,
    removeServiceAccount: mocks.removeServiceAccount,
    listServiceAccounts: mocks.listServiceAccounts,
    createServiceAccountApiKey: mocks.createServiceAccountApiKey,
    deleteServiceAccountApiKey: mocks.deleteServiceAccountApiKey,
    getServiceAccountApiKeys: mocks.getServiceAccountApiKeys,
}));

vi.mock("@sourcebot/shared", () => ({
    createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

const {
    createServiceAccountAction,
    listServiceAccounts: listServiceAccountsAction,
    removeServiceAccountAction,
    suspendServiceAccountAction,
    createServiceAccountApiKeyAction,
} = await import("./actions");

beforeEach(() => {
    mocks.role = OrgRole.OWNER;
    mocks.createServiceAccount.mockReset();
    mocks.updateServiceAccount.mockReset();
    mocks.setServiceAccountRole.mockReset();
    mocks.suspendServiceAccount.mockReset();
    mocks.reactivateServiceAccount.mockReset();
    mocks.removeServiceAccount.mockReset();
    mocks.listServiceAccounts.mockReset();
    mocks.createServiceAccountApiKey.mockReset();
    mocks.deleteServiceAccountApiKey.mockReset();
    mocks.getServiceAccountApiKeys.mockReset();
});

describe("OWNER-only authorization boundary", () => {
    test("a MEMBER cannot create a service account", async () => {
        mocks.role = OrgRole.MEMBER;

        const result = await createServiceAccountAction({ name: "CI", role: OrgRole.MEMBER });

        expect(isServiceError(result)).toBe(true);
        expect((result as ServiceError).errorCode).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
        expect(mocks.createServiceAccount).not.toHaveBeenCalled();
    });

    test("a MEMBER cannot list service accounts", async () => {
        mocks.role = OrgRole.MEMBER;

        const result = await listServiceAccountsAction();

        expect(isServiceError(result)).toBe(true);
        expect((result as ServiceError).errorCode).toBe(ErrorCode.INSUFFICIENT_PERMISSIONS);
        expect(mocks.listServiceAccounts).not.toHaveBeenCalled();
    });

    test("a MEMBER cannot remove a service account", async () => {
        mocks.role = OrgRole.MEMBER;

        const result = await removeServiceAccountAction("svc-1");

        expect(isServiceError(result)).toBe(true);
        expect(mocks.removeServiceAccount).not.toHaveBeenCalled();
    });

    test("a MEMBER cannot suspend a service account", async () => {
        mocks.role = OrgRole.MEMBER;

        const result = await suspendServiceAccountAction("svc-1");

        expect(isServiceError(result)).toBe(true);
        expect(mocks.suspendServiceAccount).not.toHaveBeenCalled();
    });

    test("a MEMBER cannot create a service account's API key", async () => {
        mocks.role = OrgRole.MEMBER;

        const result = await createServiceAccountApiKeyAction("svc-1", "ci-key");

        expect(isServiceError(result)).toBe(true);
        expect(mocks.createServiceAccountApiKey).not.toHaveBeenCalled();
    });

    test("an OWNER can create a service account, attributed to the calling human", async () => {
        mocks.role = OrgRole.OWNER;
        mocks.createServiceAccount.mockResolvedValue({
            id: "svc-1",
            name: "CI",
            description: null,
            createdById: MOCK_USER.id,
        });

        const result = await createServiceAccountAction({ name: "CI", role: OrgRole.MEMBER });

        expect(isServiceError(result)).toBe(false);
        expect(mocks.createServiceAccount).toHaveBeenCalledWith(
            MOCK_ORG.id,
            expect.objectContaining({ actor: { id: MOCK_USER.id, type: "user" }, name: "CI", role: OrgRole.MEMBER }),
        );
    });

    test("an OWNER can list service accounts", async () => {
        mocks.role = OrgRole.OWNER;
        mocks.listServiceAccounts.mockResolvedValue([]);

        const result = await listServiceAccountsAction();

        expect(result).toEqual([]);
        expect(mocks.listServiceAccounts).toHaveBeenCalledWith(MOCK_ORG.id);
    });
});
