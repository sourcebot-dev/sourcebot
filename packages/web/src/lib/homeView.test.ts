import { describe, expect, test } from "vitest";
import { getDefaultHomeView, resolveHomeView } from "./homeView";

describe("home view selection", () => {
    test("defaults to Ask when the experiment is enabled and no cookie is set", () => {
        expect(resolveHomeView(undefined, getDefaultHomeView(true))).toBe("ask");
    });

    test("defaults to Code Search when the experiment is disabled and no cookie is set", () => {
        expect(resolveHomeView(undefined, getDefaultHomeView(false))).toBe("search");
    });

    test("respects an explicit Code Search cookie when the experiment is enabled", () => {
        expect(resolveHomeView("search", getDefaultHomeView(true))).toBe("search");
    });

    test("respects an explicit Ask cookie when the experiment is disabled", () => {
        expect(resolveHomeView("ask", getDefaultHomeView(false))).toBe("ask");
    });
});
