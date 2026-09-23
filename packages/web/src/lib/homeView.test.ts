import { describe, expect, test } from "vitest";
import { resolveHomeView } from "./homeView";

describe("home view selection", () => {
    test("uses Ask when the configured default is Ask and no cookie is set", () => {
        expect(resolveHomeView(undefined, "ask")).toBe("ask");
    });

    test("uses Code Search when the configured default is Search and no cookie is set", () => {
        expect(resolveHomeView(undefined, "search")).toBe("search");
    });

    test("respects an explicit Code Search cookie when Ask is the configured default", () => {
        expect(resolveHomeView("search", "ask")).toBe("search");
    });

    test("respects an explicit Ask cookie when Search is the configured default", () => {
        expect(resolveHomeView("ask", "search")).toBe("ask");
    });
});
