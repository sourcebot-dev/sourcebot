import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    env: {
        EXPERIMENT_ASK_GH_ENABLED: "false",
    },
}));

vi.mock("@sourcebot/shared", () => ({
    env: mocks.env,
}));

describe("isAuthRequiredOverrideEnabled", () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.env.EXPERIMENT_ASK_GH_ENABLED = "false";
    });

    test("is enabled for Public SaaS deployments", async () => {
        mocks.env.EXPERIMENT_ASK_GH_ENABLED = "true";

        const { isAuthRequiredOverrideEnabled } = await import("./askAuth");

        expect(isAuthRequiredOverrideEnabled).toBe(true);
    });

    test("is disabled for self-hosted deployments", async () => {
        const { isAuthRequiredOverrideEnabled } = await import("./askAuth");

        expect(isAuthRequiredOverrideEnabled).toBe(false);
    });
});
