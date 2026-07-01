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

// Provenance for a skill imported from an indexed repository file. When present,
// the created skill becomes a read-only mirror of that file (synced via the git
// blob OID). Personal-only: shared skills never carry source.
export const agentSkillSourceSchema = z.object({
    repoName: z.string().trim().min(1),
    filePath: z.string().trim().min(1),
    revision: z.string().trim().min(1),
    blobSha: z.string().trim().min(1),
});

export const createPersonalAgentSkillInputSchema = agentSkillInputSchema.extend({
    source: agentSkillSourceSchema.optional(),
});

export const updateAgentSkillInputSchema = agentSkillInputSchema.extend({
    id: z.string().trim().min(1),
});

// The non-secret provenance surfaced to the client for a synced skill. The blob
// OID is intentionally omitted; staleness is computed server-side.
export const agentSkillSourceRefSchema = z.object({
    repoName: z.string(),
    filePath: z.string(),
    revision: z.string(),
});

// Staleness of a synced skill relative to its indexed source file. source_missing:
// the file was renamed/deleted; repo_unavailable: the repo is gone or not visible
// to the user. not_synced is returned for skills that have no source.
export const agentSkillSourceStatusSchema = z.enum([
    "in_sync",
    "update_available",
    "source_missing",
    "repo_unavailable",
    "not_synced",
]);

export type AgentSkillSource = z.infer<typeof agentSkillSourceSchema>;
export type AgentSkillSourceRef = z.infer<typeof agentSkillSourceRefSchema>;
export type AgentSkillSourceStatus = z.infer<typeof agentSkillSourceStatusSchema>;
export type CreatePersonalAgentSkillInput = z.infer<typeof createPersonalAgentSkillInputSchema>;

export const agentSkillListItemSchema = z.object({
    id: z.string(),
    scope: z.custom<AgentSkillVisibility>(),
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    instructions: z.string(),
    enabled: z.boolean(),
    // The repository file this skill mirrors, or null for manually-created and
    // local-file-imported skills. Presence marks the skill as read-only/synced.
    source: agentSkillSourceRefSchema.nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const sharedAgentSkillBaseItemSchema = agentSkillListItemSchema.omit({
    instructions: true,
    source: true,
}).extend({
    autoEnrolled: z.boolean(),
});

export const sharedAgentSkillCatalogItemSchema = sharedAgentSkillBaseItemSchema.extend({
    // Surfaced so the standalone Skills page can render a read-only preview and
    // populate the inline editor without an extra per-selection fetch. Shared
    // skills are org-wide visible, so exposing instructions here is not a leak.
    instructions: z.string(),
    // The repository file this shared skill mirrors, or null. A shared skill keeps
    // its source link when published, so the org-wide command stays synced and the
    // author/owners can refresh it from source.
    source: agentSkillSourceRefSchema.nullable(),
    // Audit metadata for the detail pane's "Added by" field. Null when the
    // creating user has no email on record.
    createdByEmail: z.string().nullable(),
    isAdopted: z.boolean(),
    isRemoved: z.boolean(),
    isVisibleToUser: z.boolean(),
    isCreatedByUser: z.boolean(),
});

export const sharedAgentSkillManagementItemSchema = sharedAgentSkillBaseItemSchema.extend({
    // The repository file this shared skill mirrors, or null for manually-created
    // and file-imported skills. Drives the Source column and the Synced/Manual
    // filter in the workspace management table.
    source: agentSkillSourceRefSchema.nullable(),
    // Creator email for the management table's "Added by" column. Null when the
    // creating user has no email on record.
    createdByEmail: z.string().nullable(),
});

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

export const sortSharedAgentSkillCatalogItems = <T extends Pick<SharedAgentSkillBaseItem, "updatedAt" | "name">>(skills: T[]) =>
    [...skills].sort((a, b) => {
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

// Maps the stored provenance columns to the client-facing source ref, or null
// when the skill has no repository link. All three columns are written together,
// so any one being absent means "not synced".
const toAgentSkillSourceRef = (
    skill: Pick<AgentSkill, "sourceRepoName" | "sourceFilePath" | "sourceRevision">,
): AgentSkillSourceRef | null =>
    skill.sourceRepoName && skill.sourceFilePath && skill.sourceRevision
        ? {
            repoName: skill.sourceRepoName,
            filePath: skill.sourceFilePath,
            revision: skill.sourceRevision,
        }
        : null;

export const toAgentSkillListItem = (
    skill: Pick<AgentSkill, "id" | "visibility" | "slug" | "name" | "description" | "instructions" | "enabled" | "createdAt" | "updatedAt" | "sourceRepoName" | "sourceFilePath" | "sourceRevision">,
): AgentSkillListItem => ({
    id: skill.id,
    scope: skill.visibility,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    enabled: skill.enabled,
    source: toAgentSkillSourceRef(skill),
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
});

const toSharedAgentSkillBaseItem = (
    skill: Pick<AgentSkill, "id" | "visibility" | "slug" | "name" | "description" | "enabled" | "autoEnrolled" | "createdAt" | "updatedAt">,
): SharedAgentSkillBaseItem => ({
    id: skill.id,
    scope: skill.visibility,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    enabled: skill.enabled,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
    autoEnrolled: skill.autoEnrolled,
});

export const toSharedAgentSkillManagementItem = (
    skill: Pick<AgentSkill, "id" | "visibility" | "slug" | "name" | "description" | "enabled" | "autoEnrolled" | "createdAt" | "updatedAt" | "sourceRepoName" | "sourceFilePath" | "sourceRevision"> & {
        createdBy: { email: string | null } | null;
    },
): SharedAgentSkillManagementItem => ({
    ...toSharedAgentSkillBaseItem(skill),
    source: toAgentSkillSourceRef(skill),
    createdByEmail: skill.createdBy?.email ?? null,
});

export const toSharedAgentSkillCatalogItem = (
    skill: Pick<AgentSkill, "id" | "visibility" | "slug" | "name" | "description" | "instructions" | "enabled" | "autoEnrolled" | "createdById" | "createdAt" | "updatedAt" | "sourceRepoName" | "sourceFilePath" | "sourceRevision"> & {
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
        source: toAgentSkillSourceRef(skill),
        createdByEmail: skill.createdBy?.email ?? null,
        isAdopted,
        isRemoved,
        isVisibleToUser: (skill.autoEnrolled || isAdopted) && !isRemoved,
        isCreatedByUser: skill.createdById === userId,
    };
};
