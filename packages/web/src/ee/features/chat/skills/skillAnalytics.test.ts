import { describe, expect, test } from "vitest";
import { buildAskSkillInvokedEvent } from "./skillAnalytics";

describe("buildAskSkillInvokedEvent", () => {
    test("builds a success payload with skill identity and the auto analytics context", () => {
        const event = buildAskSkillInvokedEvent({
            activationMethod: "auto",
            skillId: "skill-1",
            success: true,
            slug: "translate",
            name: "Translate",
            sourceLabel: "Personal",
            chatId: "chat-1",
            traceId: "trace-1",
            durationMs: 42,
        });

        expect(event).toEqual({
            source: "sourcebot-ask-agent",
            activationMethod: "auto",
            skillId: "skill-1",
            success: true,
            slug: "translate",
            name: "Translate",
            sourceLabel: "Personal",
            chatId: "chat-1",
            traceId: "trace-1",
            durationMs: 42,
        });
    });

    test("omits skill identity on failure (the skill was never resolved)", () => {
        const event = buildAskSkillInvokedEvent({
            activationMethod: "auto",
            skillId: "ghost",
            success: false,
            durationMs: 7,
        });

        expect(event).toEqual({
            source: "sourcebot-ask-agent",
            activationMethod: "auto",
            skillId: "ghost",
            success: false,
            chatId: undefined,
            traceId: undefined,
            durationMs: 7,
        });
        expect(event).not.toHaveProperty("slug");
        expect(event).not.toHaveProperty("name");
        expect(event).not.toHaveProperty("sourceLabel");
    });

    test("defaults the source to the agent but honors an explicit override (manual path)", () => {
        const manual = buildAskSkillInvokedEvent({
            activationMethod: "manual",
            skillId: "skill-1",
            success: true,
            slug: "translate",
            name: "Translate",
        });
        expect(manual.source).toBe("sourcebot-ask-agent");
        expect(manual.durationMs).toBeUndefined();
        expect(manual.sourceLabel).toBeUndefined();

        const explicit = buildAskSkillInvokedEvent({
            activationMethod: "auto",
            skillId: "skill-1",
            success: false,
            source: "sourcebot-web-client",
        });
        expect(explicit.source).toBe("sourcebot-web-client");
    });
});
