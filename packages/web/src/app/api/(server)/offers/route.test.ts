import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    offers: vi.fn(),
}));

vi.mock("@/features/billing/client", () => ({
    client: {
        offers: mocks.offers,
    },
}));

vi.mock("@sourcebot/shared", () => ({
    env: {
        SOURCEBOT_INSTALL_ID: "install-id",
    },
}));

vi.mock("@/lib/posthog", () => ({
    captureEvent: vi.fn(),
}));

const importRoute = async () => {
    vi.resetModules();
    return import("./route");
};

describe("GET /api/offers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("returns offers as JSON", async () => {
        const offers = [{ id: "startup" }];
        mocks.offers.mockResolvedValue(offers);
        const { GET } = await importRoute();

        const response = await GET(new NextRequest("https://sourcebot.example.com/api/offers"));

        expect(mocks.offers).toHaveBeenCalledTimes(1);
        expect(mocks.offers).toHaveBeenCalledWith({ installId: "install-id" });
        expect(response.headers.get("content-type")).toContain("application/json");
        expect(response.headers.get("cache-control")).toBe("public, max-age=300");
        await expect(response.json()).resolves.toEqual(offers);
    });
});
