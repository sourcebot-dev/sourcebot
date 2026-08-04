import { describe, expect, test } from "vitest";
import { skillInstructionsToSlateValue, slateValueToSkillInstructions } from "./skillInstructionsEditor";

describe("skill instructions Slate serialization", () => {
    test("round-trips file references without adding spaces around punctuation", () => {
        const instructions = "Review @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts}.";

        expect(slateValueToSkillInstructions(skillInstructionsToSlateValue(instructions))).toBe(instructions);
    });

    test("preserves trailing blank lines", () => {
        const instructions = "Review this file:\n@file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts}\n";

        expect(slateValueToSkillInstructions(skillInstructionsToSlateValue(instructions))).toBe(instructions);
    });
});
