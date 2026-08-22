import { OrgRole } from "@sourcebot/db";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    authContext: undefined as unknown,
    count: vi.fn(),
    getFailedJobIds: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({
    cache: (fn: unknown) => fn,
}));
vi.mock("@/middleware/withAuth", () => ({
    withOptionalAuth: (fn: (context: unknown) => unknown) =>
        fn(mocks.authContext),
}));
vi.mock("@/lib/bullmqClient", () => ({
    getBullMQClient: () => ({
        getFailedJobIds: mocks.getFailedJobIds,
    }),
}));

const { getRepositorySyncCounts } = await import(
    "./repositorySyncCounts.server"
);

const setAuthContext = (role?: OrgRole) => {
    mocks.authContext = {
        org: { id: 42 },
        prisma: { repo: { count: mocks.count } },
        role,
    };
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("getRepositorySyncCounts", () => {
    test.each([
        ["members", OrgRole.MEMBER],
        ["anonymous viewers", undefined],
    ])("returns first-sync counts to %s", async (_audience, role) => {
        setAuthContext(role);
        mocks.count.mockResolvedValueOnce(3);

        await expect(getRepositorySyncCounts()).resolves.toEqual({
            firstTimeSyncingCount: 3,
            failedCount: 0,
            warningCount: 0,
        });
        expect(mocks.count).toHaveBeenCalledOnce();
        expect(mocks.count).toHaveBeenCalledWith({
            where: {
                orgId: 42,
                indexedAt: null,
                firstIndexingJobFinishedAt: null,
            },
        });
        expect(mocks.getFailedJobIds).not.toHaveBeenCalled();
    });

    test("includes failure and warning counts for owners", async () => {
        setAuthContext(OrgRole.OWNER);
        mocks.count
            .mockResolvedValueOnce(3)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(2);
        mocks.getFailedJobIds.mockResolvedValue(["failed-job"]);

        await expect(getRepositorySyncCounts()).resolves.toEqual({
            firstTimeSyncingCount: 3,
            failedCount: 1,
            warningCount: 2,
        });
        expect(mocks.getFailedJobIds).toHaveBeenCalledOnce();
        expect(mocks.count).toHaveBeenCalledTimes(3);
    });
});
