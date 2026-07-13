import { describe, expect, test } from "vitest";
import { buildAskSkillInvokedEvent } from "./skillAnalytics";

describe("buildAskSkillInvokedEvent", () => {
    test("builds a success payload with safe skill metadata and the auto analytics context", () => {
        const event = buildAskSkillInvokedEvent({
            activationMethod: "auto",
            skillId: "skill-1",
            success: true,
            scope: "personal",
            isSynced: false,
            chatId: "chat-1",
            traceId: "trace-1",
            durationMs: 42,
        });

        expect(event).toEqual({
            source: "sourcebot-ask-agent",
            activationMethod: "auto",
            skillIdHash: expect.any(String),
            scope: "personal",
            isSynced: false,
            success: true,
            chatId: "chat-1",
            traceId: "trace-1",
            durationMs: 42,
        });
    });

    test("omits content-like skill identity on failure", () => {
        const event = buildAskSkillInvokedEvent({
            activationMethod: "auto",
            skillId: "ghost",
            success: false,
            failureReason: "not_found_or_unauthorized",
            durationMs: 7,
        });

        expect(event).toEqual({
            source: "sourcebot-ask-agent",
            activationMethod: "auto",
            skillIdHash: expect.any(String),
            scope: undefined,
            isSynced: undefined,
            success: false,
            failureReason: "not_found_or_unauthorized",
            chatId: undefined,
            traceId: undefined,
            durationMs: 7,
        });
    });

    test("defaults the source to the agent but honors an explicit override (manual path)", () => {
        const manual = buildAskSkillInvokedEvent({
            activationMethod: "manual",
            skillId: "skill-1",
            success: true,
            scope: "shared",
            isSynced: true,
        });
        expect(manual.source).toBe("sourcebot-ask-agent");
        expect(manual.durationMs).toBeUndefined();
        expect(manual.scope).toBe("shared");
        expect(manual.isSynced).toBe(true);
        expect(manual).not.toHaveProperty("sourceLabel");

        const explicit = buildAskSkillInvokedEvent({
            activationMethod: "auto",
            skillId: "skill-1",
            success: false,
            source: "sourcebot-web-client",
        });
        expect(explicit.source).toBe("sourcebot-web-client");
    });
});
