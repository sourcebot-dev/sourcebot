import { describe, expect, test } from "vitest";
import {
    connectionSyncResultSchema,
    connectionSyncPartialSuccessReasonSchema,
} from "./connectionSync.js";

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

describe("connectionSyncPartialSuccessReasonSchema", () => {
    test("allows a reason without a subject", () => {
        expect(
            connectionSyncPartialSuccessReasonSchema.parse({
                code: "INVALID_PROVIDER_RESPONSE",
                effect: "DISCOVERY_INCOMPLETE",
                message: "The provider returned an invalid repository.",
            }),
        ).toEqual({
            code: "INVALID_PROVIDER_RESPONSE",
            effect: "DISCOVERY_INCOMPLETE",
            message: "The provider returned an invalid repository.",
        });
    });
});
