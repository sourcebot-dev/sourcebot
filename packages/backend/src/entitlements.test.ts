import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    env: {
        DATA_CACHE_DIR: "test-data",
        PERMISSION_SYNC_ENABLED: "false",
    },
    getEntitlements: vi.fn(),
    hasEntitlement: vi.fn(),
    licenseFindUnique: vi.fn(),
}));

vi.mock("@sourcebot/shared", () => ({
    env: mocks.env,
    _getEntitlements: mocks.getEntitlements,
    _hasEntitlement: mocks.hasEntitlement,
}));

vi.mock("./prisma.js", () => ({
    prisma: {
        license: {
            findUnique: mocks.licenseFindUnique,
        },
    },
}));

import { isPermissionSyncEnabled } from "./entitlements.js";

describe("isPermissionSyncEnabled", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.env.PERMISSION_SYNC_ENABLED = "false";
        mocks.licenseFindUnique.mockResolvedValue({ id: "license" });
        mocks.hasEntitlement.mockReturnValue(true);
    });

    test("is disabled without the environment flag", async () => {
        await expect(isPermissionSyncEnabled()).resolves.toBe(false);

        expect(mocks.licenseFindUnique).not.toHaveBeenCalled();
    });

    test("requires the permission-syncing entitlement", async () => {
        mocks.env.PERMISSION_SYNC_ENABLED = "true";
        mocks.hasEntitlement.mockReturnValue(false);

        await expect(isPermissionSyncEnabled()).resolves.toBe(false);

        expect(mocks.hasEntitlement).toHaveBeenCalledWith(
            "permission-syncing",
            { id: "license" },
        );
    });

    test("is enabled when both gates pass", async () => {
        mocks.env.PERMISSION_SYNC_ENABLED = "true";

        await expect(isPermissionSyncEnabled()).resolves.toBe(true);
    });
});
