import type { AgentSkill, AgentSkillVisibility, Prisma } from "@sourcebot/db";
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

export const agentSkillInputSchema = z.object({
    name: z.string().trim().min(1, "Name is required.").max(80, "Name must be 80 characters or fewer."),
    slug: agentSkillSlugSchema,
    description: z.string().trim().max(500, "Description must be 500 characters or fewer."),
    instructions: z.string().trim().min(1, "Instructions are required.").max(20000, "Instructions must be 20,000 characters or fewer."),
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
    enabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const sharedAgentSkillBaseItemSchema = agentSkillListItemSchema.omit({
    instructions: true,
}).extend({
    featured: z.boolean(),
    autoEnrolled: z.boolean(),
});

export const sharedAgentSkillCatalogItemSchema = sharedAgentSkillBaseItemSchema.extend({
    // Surfaced so the standalone Skills page can render a read-only preview and
    // populate the inline editor without an extra per-selection fetch. Shared
    // skills are org-wide visible, so exposing instructions here is not a leak.
    instructions: z.string(),
    // Audit metadata for the detail pane's "Added by" field. Null when the
    // creating user has no email on record.
    createdByEmail: z.string().nullable(),
    isAdopted: z.boolean(),
    isRemoved: z.boolean(),
    isVisibleToUser: z.boolean(),
    isCreatedByUser: z.boolean(),
});

export const sharedAgentSkillManagementItemSchema = sharedAgentSkillBaseItemSchema;

export type AgentSkillInput = z.infer<typeof agentSkillInputSchema>;
export type UpdateAgentSkillInput = z.infer<typeof updateAgentSkillInputSchema>;
export type AgentSkillListItem = z.infer<typeof agentSkillListItemSchema>;
export type SharedAgentSkillBaseItem = z.infer<typeof sharedAgentSkillBaseItemSchema>;
export type SharedAgentSkillCatalogItem = z.infer<typeof sharedAgentSkillCatalogItemSchema>;
export type SharedAgentSkillManagementItem = z.infer<typeof sharedAgentSkillManagementItemSchema>;

export const agentSkillOrderBy = [
    { updatedAt: "desc" },
    { name: "asc" },
] satisfies Prisma.AgentSkillOrderByWithRelationInput[];

export const sortAgentSkillListItems = (skills: AgentSkillListItem[]) =>
    [...skills].sort((a, b) => {
        const updatedDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        return updatedDiff !== 0 ? updatedDiff : a.name.localeCompare(b.name);
    });

export const sortSharedAgentSkillCatalogItems = <T extends Pick<SharedAgentSkillBaseItem, "featured" | "updatedAt" | "name">>(skills: T[]) =>
    [...skills].sort((a, b) => {
        if (a.featured !== b.featured) {
            return a.featured ? -1 : 1;
        }

        const updatedDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        return updatedDiff !== 0 ? updatedDiff : a.name.localeCompare(b.name);
    });

export interface ParsedAgentSkillMarkdown {
    name?: string;
    slug?: string;
    description?: string;
    instructions: string;
    hasFrontmatter: boolean;
    frontmatterError?: string;
}

const getOptionalString = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

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

    return {
        name,
        slug: slug || undefined,
        description: getOptionalString(parsed?.description),
        instructions: body,
        hasFrontmatter: true,
    };
};

export const toAgentSkillListItem = (
    skill: Pick<AgentSkill, "id" | "visibility" | "slug" | "name" | "description" | "instructions" | "enabled" | "createdAt" | "updatedAt">,
): AgentSkillListItem => ({
    id: skill.id,
    scope: skill.visibility,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    enabled: skill.enabled,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
});

const toSharedAgentSkillBaseItem = (
    skill: Pick<AgentSkill, "id" | "visibility" | "slug" | "name" | "description" | "enabled" | "featured" | "autoEnrolled" | "createdAt" | "updatedAt">,
): SharedAgentSkillBaseItem => ({
    id: skill.id,
    scope: skill.visibility,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    enabled: skill.enabled,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
    featured: skill.featured,
    autoEnrolled: skill.autoEnrolled,
});

export const toSharedAgentSkillManagementItem = (
    skill: Pick<AgentSkill, "id" | "visibility" | "slug" | "name" | "description" | "enabled" | "featured" | "autoEnrolled" | "createdAt" | "updatedAt">,
): SharedAgentSkillManagementItem => toSharedAgentSkillBaseItem(skill);

export const toSharedAgentSkillCatalogItem = (
    skill: Pick<AgentSkill, "id" | "visibility" | "slug" | "name" | "description" | "instructions" | "enabled" | "featured" | "autoEnrolled" | "createdById" | "createdAt" | "updatedAt"> & {
        adoptions: { id: string; removedAt: Date | null }[];
        createdBy: { email: string | null } | null;
    },
    userId: string,
): SharedAgentSkillCatalogItem => {
    const isAdopted = skill.adoptions.some((adoption) => adoption.removedAt === null);
    const isRemoved = skill.adoptions.some((adoption) => adoption.removedAt !== null);
    return {
        ...toSharedAgentSkillBaseItem(skill),
        instructions: skill.instructions,
        createdByEmail: skill.createdBy?.email ?? null,
        isAdopted,
        isRemoved,
        isVisibleToUser: (skill.autoEnrolled || isAdopted) && !isRemoved,
        isCreatedByUser: skill.createdById === userId,
    };
};
