import { describe, expect, test } from "vitest";
import {
    exampleQuestions,
    selectRandomExampleQuestions,
} from "./exampleQuestions";

describe("selectRandomExampleQuestions", () => {
    test("selects three unique questions from the larger pool", () => {
        const selectedQuestions = selectRandomExampleQuestions(3, () => 0);

        expect(exampleQuestions.length).toBeGreaterThan(3);
        expect(selectedQuestions).toHaveLength(3);
        expect(new Set(selectedQuestions.map(({ label }) => label)).size).toBe(3);
        expect(selectedQuestions.every((question) =>
            exampleQuestions.some(({ label }) => label === question.label)
        )).toBe(true);
    });
});
