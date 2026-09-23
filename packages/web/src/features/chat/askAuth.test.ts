import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    env: {
        EXPERIMENT_ASK_GH_ENABLED: "false",
    },
}));

vi.mock("@sourcebot/shared", () => ({
    env: mocks.env,
}));

const { checkAuthenticationRequiredOverride } = await import("./askAuth");

beforeEach(() => {
    mocks.env.EXPERIMENT_ASK_GH_ENABLED = "false";
});

describe("checkAuthenticationRequiredOverride", () => {
    test("rejects anonymous Ask requests when Public SaaS is enabled", () => {
        mocks.env.EXPERIMENT_ASK_GH_ENABLED = "true";

        expect(checkAuthenticationRequiredOverride(undefined)).toEqual({
            statusCode: 401,
            errorCode: "NOT_AUTHENTICATED",
            message: "Not authenticated",
        });
    });

    test("allows authenticated Ask requests when Public SaaS is enabled", () => {
        mocks.env.EXPERIMENT_ASK_GH_ENABLED = "true";

        expect(checkAuthenticationRequiredOverride({ id: "user-1" })).toBeNull();
    });

    test("allows anonymous Ask requests when Public SaaS is disabled", () => {
        expect(checkAuthenticationRequiredOverride(undefined)).toBeNull();
    });
});
