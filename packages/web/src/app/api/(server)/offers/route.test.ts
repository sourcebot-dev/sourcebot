import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    env: {
        SOURCEBOT_INSTALL_ID: "test-install-id",
    },
    offers: [
        { id: "team-monthly", name: "Team", price: { monthly: 100, yearly: 1000 } },
        { id: "enterprise-monthly", name: "Enterprise", price: { monthly: 500, yearly: 5000 } },
    ] as unknown,
}));

vi.mock("@sourcebot/shared", () => ({
    env: mocks.env,
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

vi.mock("@/features/billing/client", () => ({
    client: {
        offers: vi.fn().mockResolvedValue(mocks.offers),
    },
}));

vi.mock("@opentelemetry/sdk-trace-base", () => ({
    getEnv: () => ({}),
    TraceIdRatioBasedSampler: vi.fn(),
    ParentBasedSampler: vi.fn(),
    AlwaysOnSampler: vi.fn(),
    AlwaysOffSampler: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
    captureEvent: vi.fn(),
}));

import { GET } from "./route";

const makeRequest = () => new NextRequest("https://example.com/api/offers");

describe("GET /api/offers", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns a 200 with the offers as JSON", async () => {
        const response = await GET(makeRequest(), {});
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual(mocks.offers);
    });

    it("sets Content-Type: application/json", async () => {
        const response = await GET(makeRequest(), {});
        // Next.js / Web Headers are case-insensitive, but be defensive
        const contentType = response.headers.get("Content-Type") ?? response.headers.get("content-type") ?? "";
        expect(contentType).toContain("application/json");
    });

    it("preserves the public cache-control header", async () => {
        const response = await GET(makeRequest(), {});
        const cacheControl = response.headers.get("Cache-Control") ?? "";
        expect(cacheControl).toContain("public");
        expect(cacheControl).toContain("max-age=300");
    });
});
