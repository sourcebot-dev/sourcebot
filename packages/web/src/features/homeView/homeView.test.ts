import { describe, expect, test } from "vitest";
import { resolveHomeView } from "./homeView";

describe("resolveHomeView", () => {
    test("uses the org default when an authenticated user has no personal preference", () => {
        expect(resolveHomeView({ orgDefault: "ASK" })).toBe("ask");
    });

    test("uses an explicit personal preference over the org default", () => {
        expect(resolveHomeView({ personalPreference: "search", orgDefault: "ASK" })).toBe("search");
    });

    test("falls back to search when the org default is unset", () => {
        expect(resolveHomeView({ orgDefault: undefined })).toBe("search");
    });

    test("uses the org default for anonymous users without a personal preference", () => {
        expect(resolveHomeView({ personalPreference: undefined, orgDefault: "ASK" })).toBe("ask");
    });
});
