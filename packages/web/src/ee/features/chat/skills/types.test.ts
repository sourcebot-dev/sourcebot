import { describe, expect, test } from "vitest";
import {
    agentSkillInputSchema,
    normalizeAgentSkillSlug,
    parseAgentSkillMarkdown,
    sortAgentSkillListItems,
    toOrgAgentSkillCatalogItem,
    toOrgAgentSkillManagementItem,
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

    test("defaults argument names to an empty array", () => {
        const result = agentSkillInputSchema.safeParse({
            name: "PR review",
            slug: "pr-review",
            description: "",
            instructions: "Find correctness issues.",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.argumentNames).toEqual([]);
        }
    });

    test("rejects invalid argument names", () => {
        const result = agentSkillInputSchema.safeParse({
            name: "Tutorial",
            slug: "tutorial",
            description: "",
            instructions: "Write about $topic.",
            argumentNames: ["0", "topic"],
        });

        expect(result.success).toBe(false);
    });

    test("rejects duplicate argument names", () => {
        const result = agentSkillInputSchema.safeParse({
            name: "Tutorial",
            slug: "tutorial",
            description: "",
            instructions: "Write about $topic.",
            argumentNames: ["topic", "topic"],
        });

        expect(result.success).toBe(false);
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
        argumentNames: [],
        enabled: true,
        autoInvocationEnabled: false,
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

describe("toOrgAgentSkillCatalogItem", () => {
    test("does not expose instructions or author identity", () => {
        const item = toOrgAgentSkillCatalogItem({
            id: "skill-1",
            visibility: "ORG",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            argumentNames: ["path"],
            enabled: true,
            autoInvocationEnabled: true,
            featured: false,
            autoEnrolled: true,
            createdById: "user-1",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
            adoptions: [{ id: "adoption-1", removedAt: null }],
        }, "user-1");

        expect(item).toEqual({
            id: "skill-1",
            scope: "ORG",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            argumentNames: ["path"],
            enabled: true,
            autoInvocationEnabled: true,
            featured: false,
            autoEnrolled: true,
            isAdopted: true,
            isRemoved: false,
            isVisibleToUser: true,
            isCreatedByUser: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
        });
        expect(item).not.toHaveProperty("instructions");
        expect(item).not.toHaveProperty("author");
        expect(item).not.toHaveProperty("createdById");
    });
});

describe("toOrgAgentSkillManagementItem", () => {
    test("contains global management fields without requester adoption state", () => {
        const item = toOrgAgentSkillManagementItem({
            id: "skill-1",
            visibility: "ORG",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            argumentNames: ["path"],
            enabled: true,
            autoInvocationEnabled: true,
            featured: true,
            autoEnrolled: false,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        });

        expect(item).toEqual({
            id: "skill-1",
            scope: "ORG",
            slug: "review",
            name: "Review",
            description: "Review risky changes.",
            argumentNames: ["path"],
            enabled: true,
            autoInvocationEnabled: true,
            featured: true,
            autoEnrolled: false,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
        });
        expect(item).not.toHaveProperty("instructions");
        expect(item).not.toHaveProperty("isAdopted");
        expect(item).not.toHaveProperty("isVisibleToUser");
        expect(item).not.toHaveProperty("isCreatedByUser");
    });
});

describe("parseAgentSkillMarkdown", () => {
    test("prefers an explicit slug from front matter over the name", () => {
        const result = parseAgentSkillMarkdown(`---
name: PR Review
slug: review-pr
description: Review a pull request for risky changes.
arguments: branch topic
---
# Workflow

Look for bugs first.
`, "ignored.md");

        expect(result).toEqual({
            name: "PR Review",
            slug: "review-pr",
            description: "Review a pull request for risky changes.",
            argumentNames: ["branch", "topic"],
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

    test("parses argument names from front matter arrays", () => {
        const result = parseAgentSkillMarkdown(`---
name: Tutorial
arguments:
  - language
  - topic
---
Write a tutorial.
`);

        expect(result.argumentNames).toEqual(["language", "topic"]);
        expect(result.frontmatterError).toBeUndefined();
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

    test("preserves valid front matter when argument names are invalid", () => {
        const result = parseAgentSkillMarkdown(`---
name: Tutorial
command: /tutorial
description: Draft a tutorial.
arguments: 0 topic
---
Write a tutorial.
`);

        expect(result).toEqual({
            name: "Tutorial",
            slug: "tutorial",
            description: "Draft a tutorial.",
            argumentNames: undefined,
            instructions: "Write a tutorial.",
            hasFrontmatter: true,
            frontmatterError: "Invalid arguments front matter: Invalid argument name: 0",
        });
    });

    test("does not drop empty argument names from front matter arrays", () => {
        const result = parseAgentSkillMarkdown(`---
name: Tutorial
arguments:
  - language
  - ""
  - topic
---
Write a tutorial.
`);

        expect(result.argumentNames).toBeUndefined();
        expect(result.frontmatterError).toBe("Invalid arguments front matter: Invalid argument name: ");
    });

    test("rejects duplicate argument names in front matter", () => {
        const result = parseAgentSkillMarkdown(`---
name: Tutorial
arguments: topic topic
---
Write a tutorial.
`);

        expect(result.argumentNames).toBeUndefined();
        expect(result.frontmatterError).toBe("Invalid arguments front matter: Argument names must be unique.");
    });

    test("falls back to the filename when no front matter exists", () => {
        const result = parseAgentSkillMarkdown("Use short answers.", "short-answers.md");

        expect(result.name).toBe("Short Answers");
        expect(result.slug).toBe("short-answers");
        expect(result.instructions).toBe("Use short answers.");
        expect(result.hasFrontmatter).toBe(false);
    });
});
