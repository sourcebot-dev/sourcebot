import { describe, expect, test } from "vitest";
import { resolveHomeView } from "./homeView";

describe("home view selection", () => {
    test("defaults to Ask when the experiment is enabled and no cookie is set", () => {
        expect(resolveHomeView(undefined, "ask")).toBe("ask");
    });

    test("defaults to Code Search when the experiment is disabled and no cookie is set", () => {
        expect(resolveHomeView(undefined, "search")).toBe("search");
    });

    test("respects an explicit Code Search cookie when the experiment is enabled", () => {
        expect(resolveHomeView("search", "ask")).toBe("search");
    });

    test("respects an explicit Ask cookie when the experiment is disabled", () => {
        expect(resolveHomeView("ask", "search")).toBe("ask");
    });
});
