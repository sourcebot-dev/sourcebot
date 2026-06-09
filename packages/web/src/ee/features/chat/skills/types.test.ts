import { describe, expect, test } from "vitest";
import {
    agentSkillInputSchema,
    normalizeAgentSkillSlug,
    parseAgentSkillMarkdown,
    sortAgentSkillListItems,
    type AgentSkillListItem,
} from "./types";

describe("normalizeAgentSkillSlug", () => {
    test("turns display text into a slash-command slug", () => {
        expect(normalizeAgentSkillSlug("Review PR for Risky Changes")).toBe("review-pr-for-risky-changes");
    });

    test("removes unsupported leading and trailing characters", () => {
        expect(normalizeAgentSkillSlug("  /Release Notes!!!  ")).toBe("release-notes");
    });
});

describe("agentSkillInputSchema", () => {
    test("normalizes slug before validation", () => {
        const result = agentSkillInputSchema.safeParse({
            name: "PR review",
            slug: "PR Review",
            description: "Review a pull request.",
            instructions: "Find correctness issues.",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.slug).toBe("pr-review");
        }
    });

    test("rejects empty normalized slug", () => {
        const result = agentSkillInputSchema.safeParse({
            name: "PR review",
            slug: "!!!",
            description: "Review a pull request.",
            instructions: "Find correctness issues.",
        });

        expect(result.success).toBe(false);
    });

    test("allows an empty description", () => {
        const result = agentSkillInputSchema.safeParse({
            name: "PR review",
            slug: "pr-review",
            description: "",
            instructions: "Find correctness issues.",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.description).toBe("");
        }
    });
});

describe("sortAgentSkillListItems", () => {
    const skill = (overrides: Partial<AgentSkillListItem>): AgentSkillListItem => ({
        id: "skill",
        scope: "PERSONAL" as AgentSkillListItem["scope"],
        slug: "skill",
        name: "Skill",
        description: "Description.",
        instructions: "Instructions.",
        enabled: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    });

    test("sorts by updated date descending, then name ascending", () => {
        const skills = [
            skill({ id: "older", name: "Older", updatedAt: "2026-01-01T00:00:00.000Z" }),
            skill({ id: "z-newer", name: "Z newer", updatedAt: "2026-01-02T00:00:00.000Z" }),
            skill({ id: "a-newer", name: "A newer", updatedAt: "2026-01-02T00:00:00.000Z" }),
        ];

        expect(sortAgentSkillListItems(skills).map((item) => item.id)).toEqual([
            "a-newer",
            "z-newer",
            "older",
        ]);
        expect(skills.map((item) => item.id)).toEqual(["older", "z-newer", "a-newer"]);
    });
});

describe("parseAgentSkillMarkdown", () => {
    test("prefers an explicit slug from front matter over the name", () => {
        const result = parseAgentSkillMarkdown(`---
name: PR Review
slug: review-pr
description: Review a pull request for risky changes.
---
# Workflow

Look for bugs first.
`, "ignored.md");

        expect(result).toEqual({
            name: "PR Review",
            slug: "review-pr",
            description: "Review a pull request for risky changes.",
            instructions: "# Workflow\n\nLook for bugs first.",
            hasFrontmatter: true,
        });
    });

    test("prefers an explicit command over the title-derived slug", () => {
        const result = parseAgentSkillMarkdown(`---
title: Release notes
command: /release
description: Draft user-facing release notes.
---
Summarize merged changes.
`);

        expect(result.name).toBe("Release notes");
        expect(result.slug).toBe("release");
        expect(result.description).toBe("Draft user-facing release notes.");
        expect(result.instructions).toBe("Summarize merged changes.");
    });

    test("derives the slug from the name when no explicit slug is given", () => {
        const result = parseAgentSkillMarkdown(`---
name: Release notes
description: Draft user-facing release notes.
---
Summarize merged changes.
`);

        expect(result.slug).toBe("release-notes");
    });

    test("falls back to the filename when no front matter exists", () => {
        const result = parseAgentSkillMarkdown("Use short answers.", "short-answers.md");

        expect(result.name).toBe("Short Answers");
        expect(result.slug).toBe("short-answers");
        expect(result.instructions).toBe("Use short answers.");
        expect(result.hasFrontmatter).toBe(false);
    });
});
