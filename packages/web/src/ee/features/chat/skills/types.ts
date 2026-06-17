import type { AgentSkill, AgentSkillVisibility, Prisma } from "@sourcebot/db";
import { isValidArgumentName, parseArgumentNames } from "@/features/chat/commands/argumentSubstitution";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const normalizeAgentSkillSlug = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64)
        .replace(/-+$/g, "");

const agentSkillSlugSchema = z.string()
    .transform(normalizeAgentSkillSlug)
    .pipe(z.string()
        .min(1, "Command is required.")
        .max(64, "Command must be 64 characters or fewer.")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Command can only contain lowercase letters, numbers, and hyphens."));

const agentSkillArgumentNameSchema = z.string()
    .trim()
    .min(1, "Argument name cannot be empty.")
    .refine(isValidArgumentName, "Argument names must be identifiers and cannot be numeric or reserved.");

const hasUniqueArgumentNames = (names: string[]) => new Set(names).size === names.length;

export const agentSkillInputSchema = z.object({
    name: z.string().trim().min(1, "Name is required.").max(80, "Name must be 80 characters or fewer."),
    slug: agentSkillSlugSchema,
    description: z.string().trim().max(500, "Description must be 500 characters or fewer."),
    instructions: z.string().trim().min(1, "Instructions are required.").max(20000, "Instructions must be 20,000 characters or fewer."),
    argumentNames: z.array(agentSkillArgumentNameSchema)
        .max(20, "Skills can have at most 20 named arguments.")
        .refine(hasUniqueArgumentNames, "Argument names must be unique.")
        .default([]),
});

export const updateAgentSkillInputSchema = agentSkillInputSchema.extend({
    id: z.string().trim().min(1),
});

export const agentSkillListItemSchema = z.object({
    id: z.string(),
    scope: z.custom<AgentSkillVisibility>(),
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    instructions: z.string(),
    argumentNames: z.array(z.string()),
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const orgAgentSkillCatalogItemSchema = agentSkillListItemSchema.omit({
    instructions: true,
}).extend({
    featured: z.boolean(),
    autoEnrolled: z.boolean(),
    isAdopted: z.boolean(),
});

export type AgentSkillInput = z.infer<typeof agentSkillInputSchema>;
export type UpdateAgentSkillInput = z.infer<typeof updateAgentSkillInputSchema>;
export type AgentSkillListItem = z.infer<typeof agentSkillListItemSchema>;
export type OrgAgentSkillCatalogItem = z.infer<typeof orgAgentSkillCatalogItemSchema>;

export const agentSkillOrderBy = [
    { updatedAt: "desc" },
    { name: "asc" },
] satisfies Prisma.AgentSkillOrderByWithRelationInput[];

export const sortAgentSkillListItems = (skills: AgentSkillListItem[]) =>
    [...skills].sort((a, b) => {
        const updatedDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        return updatedDiff !== 0 ? updatedDiff : a.name.localeCompare(b.name);
    });

export interface ParsedAgentSkillMarkdown {
    name?: string;
    slug?: string;
    description?: string;
    argumentNames?: string[];
    instructions: string;
    hasFrontmatter: boolean;
    frontmatterError?: string;
}

const getOptionalString = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const getOptionalArgumentNames = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) {
        const names = parseArgumentNames(value);
        if (!hasUniqueArgumentNames(names)) {
            throw new Error("Argument names must be unique.");
        }
        return names.length > 0 ? names : undefined;
    }

    if (Array.isArray(value)) {
        const names: string[] = [];
        for (const item of value) {
            const name = typeof item === "string" ? item.trim() : String(item);
            if (typeof item !== "string" || !isValidArgumentName(name)) {
                throw new Error(`Invalid argument name: ${name}`);
            }
            names.push(name);
        }
        if (!hasUniqueArgumentNames(names)) {
            throw new Error("Argument names must be unique.");
        }
        return names.length > 0 ? names : undefined;
    }

    return undefined;
};

const fileNameToSkillName = (fileName?: string) => {
    if (!fileName) {
        return undefined;
    }

    const stem = fileName.replace(/\.[^.]+$/, "");
    return stem
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
};

export const parseAgentSkillMarkdown = (
    content: string,
    fileName?: string,
): ParsedAgentSkillMarkdown => {
    const text = content.replace(/^\uFEFF/, "");
    const fallbackName = fileNameToSkillName(fileName);
    const fallbackSlug = fallbackName ? normalizeAgentSkillSlug(fallbackName) : undefined;
    const frontmatterMatch = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);

    if (!frontmatterMatch) {
        return {
            name: fallbackName,
            slug: fallbackSlug,
            instructions: text.trim(),
            hasFrontmatter: false,
        };
    }

    const rawFrontmatter = frontmatterMatch[1];
    const body = text.slice(frontmatterMatch[0].length).trim();

    let parsed: Record<string, unknown> | null;
    try {
        parsed = parseYaml(rawFrontmatter) as Record<string, unknown> | null;
    } catch (error) {
        return {
            name: fallbackName,
            slug: fallbackSlug,
            instructions: body,
            hasFrontmatter: true,
            frontmatterError: error instanceof Error ? error.message : "Could not parse front matter.",
        };
    }

    const name = getOptionalString(parsed?.name) ?? getOptionalString(parsed?.title) ?? fallbackName;
    const explicitSlug = getOptionalString(parsed?.slug) ?? getOptionalString(parsed?.command);
    const slug = explicitSlug
        ? normalizeAgentSkillSlug(explicitSlug)
        : name
            ? normalizeAgentSkillSlug(name)
            : fallbackSlug;

    let argumentNames: string[] | undefined;
    let frontmatterError: string | undefined;
    try {
        argumentNames = getOptionalArgumentNames(parsed?.arguments);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not parse arguments.";
        frontmatterError = `Invalid arguments front matter: ${message}`;
    }

    return {
        name,
        slug: slug || undefined,
        description: getOptionalString(parsed?.description),
        argumentNames,
        instructions: body,
        hasFrontmatter: true,
        frontmatterError,
    };
};

export const toAgentSkillListItem = (
    skill: Pick<AgentSkill, "id" | "visibility" | "slug" | "name" | "description" | "instructions" | "argumentNames" | "enabled" | "createdAt" | "updatedAt">,
): AgentSkillListItem => ({
    id: skill.id,
    scope: skill.visibility,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    argumentNames: skill.argumentNames,
    enabled: skill.enabled,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
});

export const toOrgAgentSkillCatalogItem = (
    skill: Pick<AgentSkill, "id" | "visibility" | "slug" | "name" | "description" | "argumentNames" | "enabled" | "featured" | "autoEnrolled" | "createdAt" | "updatedAt"> & {
        adoptions: { id: string }[];
    },
): OrgAgentSkillCatalogItem => ({
    id: skill.id,
    scope: skill.visibility,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    argumentNames: skill.argumentNames,
    enabled: skill.enabled,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
    featured: skill.featured,
    autoEnrolled: skill.autoEnrolled,
    isAdopted: skill.adoptions.length > 0,
});
