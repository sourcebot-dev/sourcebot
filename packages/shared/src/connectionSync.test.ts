import { describe, expect, test } from "vitest";
import { connectionSyncResultSchema } from "./connectionSync.js";

describe("connectionSyncResultSchema", () => {
    test("accepts a successful result", () => {
        expect(
            connectionSyncResultSchema.parse({ outcome: "SUCCESS" }),
        ).toEqual({ outcome: "SUCCESS" });
    });

    test("accepts a partial success with structured reasons", () => {
        const reason = {
            code: "NOT_FOUND_OR_INACCESSIBLE",
            effect: "TARGET_SKIPPED",
            subject: {
                kind: "repository",
                value: "sourcebot-dev/missing-repo",
            },
            message:
                "Repository sourcebot-dev/missing-repo was not found or is inaccessible.",
        };

        expect(
            connectionSyncResultSchema.parse({
                outcome: "PARTIAL_SUCCESS",
                reasons: [reason],
            }),
        ).toEqual({
            outcome: "PARTIAL_SUCCESS",
            reasons: [reason],
        });
    });

    test("requires at least one reason for a partial success", () => {
        expect(
            connectionSyncResultSchema.safeParse({
                outcome: "PARTIAL_SUCCESS",
                reasons: [],
            }).success,
        ).toBe(false);
    });
});
