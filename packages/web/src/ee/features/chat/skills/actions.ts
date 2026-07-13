'use server';

import { checkAskEntitlement } from "@/features/chat/utils.server";
import { type AskCommandDefinition } from "@/features/chat/commands/types";
import { getBlobContentForRepo, getFileSourceForRepo, resolveFileBlobShaForRepo } from "@/features/git";
import { ErrorCode } from "@/lib/errorCodes";
import { captureEvent } from "@/lib/posthog";
import type {
    AskSkillActorRelationship,
    AskSkillChangedField,
    AskSkillCreationMethod,
    AskSkillEntryPoint,
    PosthogEventMap,
} from "@/lib/posthogEvents";
import { isRecordNotFoundError, isUniqueConstraintError } from "@/lib/prismaErrors";
import { requestBodySchemaValidationError, unexpectedError, ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole, Prisma, sharedAgentSkillAuthScope, sharedAgentSkillScope, sharedAgentSkillVisibleToUserWhere, personalAgentSkillAuthScope, personalAgentSkillScope, type AgentSkill, type Org, type PrismaClient } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@sourcebot/shared";
import {
    agentSkillInputSchema,
    agentSkillOrderBy,
    createPersonalAgentSkillInputSchema,
    parseAgentSkillMarkdown,
    toSharedAgentSkillCatalogItem,
    toSharedAgentSkillManagementItem,
    toAgentSkillListItem,
    updateAgentSkillInputSchema,
    type AgentSkillInput,
    type AgentSkillListItem,
    type AgentSkillSourceStatus,
    type AgentSkillSyncField,
    type AgentSkillSyncPreview,
    type CreatePersonalAgentSkillInput,
    type ParsedAgentSkillMarkdown,
    type SharedAgentSkillCatalogItem,
    type SharedAgentSkillManagementItem,
    type UpdateAgentSkillInput,
} from "./types";
import {
    listSharedAgentSkillCommandsForContext,
    listPersonalAgentSkillCommandsForContext,
} from "./commandCatalog";
import { canAccessSkillSource, filterSkillsBySourceRepoAccess } from "./sourceRepoAccess";
import { hashSkillId, normalizeSkillAnalyticsEntryPoint } from "./skillAnalytics";

const skillAlreadyExists = (slug: string): ServiceError => ({
    statusCode: StatusCodes.CONFLICT,
    errorCode: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
    message: `A skill with command /${slug} already exists.`,
});

const skillNotFound = (): ServiceError => ({
    statusCode: StatusCodes.NOT_FOUND,
    errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
    message: "Skill not found.",
});

const insufficientSkillPermissions = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message: "You do not have sufficient permissions to manage this skill.",
});

const skillNotSynced = (): ServiceError => ({
    statusCode: StatusCodes.BAD_REQUEST,
    errorCode: ErrorCode.INVALID_REQUEST_BODY,
    message: "This skill is not linked to a repository source.",
});

const skillSourceInvalid = (): ServiceError => ({
    statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
    errorCode: ErrorCode.INVALID_REQUEST_BODY,
    message: "The source file is no longer a valid skill.",
});

const refreshSkillSettingsViews = () => {
    revalidatePath("/settings/skills");
    revalidatePath("/settings/workspaceAskAgent");
    refresh();
};

type SkillAnalyticsContext = {
    entryPoint?: AskSkillEntryPoint;
    creationMethod?: AskSkillCreationMethod;
};

const SKILL_ANALYTICS_SOURCE = 'sourcebot-web-client' as const;

type SkillOutcomeEventName = {
    [EventName in keyof PosthogEventMap]: PosthogEventMap[EventName] extends { success: boolean }
        ? EventName
        : never;
}[keyof PosthogEventMap];
type SkillEventBase<EventName extends SkillOutcomeEventName> =
    Omit<PosthogEventMap[EventName], "success" | "failureReason">;
type SkillEventOutcome =
    | { success: true }
    | { success: false; failureReason: string };

const emitSkillEvent = <EventName extends SkillOutcomeEventName>(
    eventName: EventName,
    base: SkillEventBase<EventName>,
    outcome: SkillEventOutcome,
) => {
    void captureEvent(eventName, {
        ...base,
        ...outcome,
    } as PosthogEventMap[EventName]);
};

const getSkillAnalyticsEntryPoint = (analytics?: SkillAnalyticsContext): AskSkillEntryPoint =>
    normalizeSkillAnalyticsEntryPoint(analytics?.entryPoint);

const getSkillFailureReason = (error: ServiceError): string => error.errorCode;

const isSyncedSkill = (skill: { sourceRepoName: string | null }) =>
    typeof skill.sourceRepoName === "string";

const getSharedSkillActorRelationship = (
    skill: { createdById: string },
    userId: string,
    role: OrgRole,
): AskSkillActorRelationship => {
    if (skill.createdById === userId) {
        return 'creator';
    }
    if (role === OrgRole.OWNER) {
        return 'owner';
    }
    return 'member';
};

const getChangedFieldTypes = (
    before: Pick<AgentSkill, "name" | "slug" | "description" | "instructions">,
    after: AgentSkillInput,
): AskSkillChangedField[] => {
    const changedFields: AskSkillChangedField[] = [];
    if (before.name !== after.name) {
        changedFields.push('name');
    }
    if (before.slug !== after.slug) {
        changedFields.push('command');
    }
    if (before.description !== after.description) {
        changedFields.push('description');
    }
    if (before.instructions !== after.instructions) {
        changedFields.push('instructions');
    }
    return changedFields;
};

const sharedCatalogSkillSelect = (userId: string, orgId: number) => ({
    id: true,
    visibility: true,
    slug: true,
    name: true,
    description: true,
    instructions: true,
    enabled: true,
    autoEnrolled: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
    sourceRepoName: true,
    sourceFilePath: true,
    sourceRevision: true,
    createdBy: {
        select: {
            email: true,
        },
    },
    adoptions: {
        where: {
            userId,
            orgId,
        },
        select: {
            id: true,
            removedAt: true,
        },
    },
});

const sharedManagementSkillSelect = {
    id: true,
    visibility: true,
    slug: true,
    name: true,
    description: true,
    enabled: true,
    autoEnrolled: true,
    createdAt: true,
    updatedAt: true,
    sourceRepoName: true,
    sourceFilePath: true,
    sourceRevision: true,
    createdBy: { select: { email: true } },
} satisfies Prisma.AgentSkillSelect;

type AgentSkillWriteClient = Pick<PrismaClient, "agentSkill" | "agentSkillAdoption">;
type ManageableSharedSkill = {
    id: string;
    createdById: string;
    sourceRepoName: string | null;
};
type ManageableSharedSkillUpdateSnapshot = ManageableSharedSkill & Pick<
    AgentSkill,
    "name" | "slug" | "description" | "instructions"
>;
type RequireManageableSharedSkillParams = {
    prisma: PrismaClient;
    orgId: number;
    userId: string;
    role: OrgRole;
    skillId: string;
    requireEnabled?: boolean;
};

// The provenance columns copied verbatim when a synced skill changes scope
// (publish or make-personal), so the new row stays linked to the same source
// file at the same imported version.
type AgentSkillSourceColumns = Pick<
    AgentSkill,
    "sourceRepoName" | "sourceFilePath" | "sourceRevision" | "sourceBlobSha" | "sourceImportedAt"
>;

const sourceColumnsCarryOver = (skill: AgentSkillSourceColumns): AgentSkillSourceColumns => ({
    sourceRepoName: skill.sourceRepoName,
    sourceFilePath: skill.sourceFilePath,
    sourceRevision: skill.sourceRevision,
    sourceBlobSha: skill.sourceBlobSha,
    sourceImportedAt: skill.sourceImportedAt,
});

const canManageSharedSkill = (
    skill: { createdById: string },
    userId: string,
    role: OrgRole,
) => skill.createdById === userId || role === OrgRole.OWNER;

async function requireManageableSharedSkill(
    params: RequireManageableSharedSkillParams & { includeUpdateSnapshot: true },
): Promise<ManageableSharedSkillUpdateSnapshot | ServiceError>;
async function requireManageableSharedSkill(
    params: RequireManageableSharedSkillParams & { includeUpdateSnapshot?: false },
): Promise<ManageableSharedSkill | ServiceError>;
async function requireManageableSharedSkill({
    prisma,
    orgId,
    userId,
    role,
    skillId,
    requireEnabled = true,
    includeUpdateSnapshot = false,
}: RequireManageableSharedSkillParams & { includeUpdateSnapshot?: boolean }): Promise<
    ManageableSharedSkill | ManageableSharedSkillUpdateSnapshot | ServiceError
> {
    const where = {
        id: skillId,
        ...sharedAgentSkillAuthScope(orgId),
        ...(requireEnabled ? { enabled: true } : {}),
    };
    const skill = includeUpdateSnapshot
        ? await prisma.agentSkill.findFirst({
            where,
            select: {
                id: true,
                createdById: true,
                sourceRepoName: true,
                name: true,
                slug: true,
                description: true,
                instructions: true,
            },
        })
        : await prisma.agentSkill.findFirst({
            where,
            select: {
                id: true,
                createdById: true,
                sourceRepoName: true,
            },
        });

    if (!skill) {
        return skillNotFound();
    }

    if (!canManageSharedSkill(skill, userId, role)) {
        return insufficientSkillPermissions();
    }

    return skill;
}

const sharedSkillCreateDataForUser = ({
    orgId,
    userId,
    skill,
    source,
}: {
    orgId: number;
    userId: string;
    // Accepts either a full skill input (direct shared creation) or a partial
    // copy (publishing a personal skill).
    skill: Pick<AgentSkillInput, "slug" | "name" | "description" | "instructions">;
    // When publishing a synced personal skill, its provenance is carried over so
    // the shared skill stays linked to the same source file.
    source?: AgentSkillSourceColumns | null;
}) => ({
    ...sharedAgentSkillScope(orgId),
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    createdById: userId,
    updatedById: userId,
    ...(source ? sourceColumnsCarryOver(source) : {}),
    adoptions: {
        create: {
            orgId,
            userId,
            removedAt: null,
        },
    },
});

const createSharedSkillForUser = async ({
    prisma,
    orgId,
    userId,
    skill,
}: {
    prisma: AgentSkillWriteClient;
    orgId: number;
    userId: string;
    skill: AgentSkillInput;
}) => {
    const createdSkill = await prisma.agentSkill.create({
        data: sharedSkillCreateDataForUser({ orgId, userId, skill }),
    });

    return createdSkill;
};

const removeSharedSkillForUser = async ({
    prisma,
    orgId,
    userId,
    skill,
}: {
    prisma: AgentSkillWriteClient;
    orgId: number;
    userId: string;
    skill: { id: string; autoEnrolled: boolean };
}) => {
    if (skill.autoEnrolled) {
        const removedAt = new Date();
        await prisma.agentSkillAdoption.upsert({
            where: {
                orgId_userId_agentSkillId: {
                    orgId,
                    userId,
                    agentSkillId: skill.id,
                },
            },
            create: {
                orgId,
                userId,
                agentSkillId: skill.id,
                removedAt,
            },
            update: {
                removedAt,
            },
        });
        return;
    }

    await prisma.agentSkillAdoption.deleteMany({
        where: {
            orgId,
            userId,
            agentSkillId: skill.id,
        },
    });
};

const sharedSkillFlagInputSchema = z.object({
    skillId: z.string().trim().min(1),
    data: z.object({
        autoEnrolled: z.boolean().optional(),
    }).strict().refine(
        (data) => Object.keys(data).length === 1,
        "Exactly one shared skill flag must be provided.",
    ),
});

type SharedSkillFlagInput = z.infer<typeof sharedSkillFlagInputSchema>;

export const listPersonalAgentSkills = async (): Promise<AgentSkillListItem[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skills = await prisma.agentSkill.findMany({
            where: {
                ...personalAgentSkillAuthScope(user.id, org.id),
            },
            orderBy: agentSkillOrderBy,
        });

        return skills.map(toAgentSkillListItem);
    }));

export const listPersonalAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        return listPersonalAgentSkillCommandsForContext({ prisma, userId: user.id, orgId: org.id });
    }));

export const getPersonalAgentSkill = async (
    skillId: string,
): Promise<AgentSkillListItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...personalAgentSkillAuthScope(user.id, org.id),
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        return toAgentSkillListItem(skill);
    }));

export const getSharedAgentSkill = async (
    skillId: string,
): Promise<AgentSkillListItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const manageableSkill = await requireManageableSharedSkill({
            prisma,
            orgId: org.id,
            userId: user.id,
            role,
            skillId,
            requireEnabled: true,
        });

        if ("errorCode" in manageableSkill) {
            return manageableSkill;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: manageableSkill.id,
                ...sharedAgentSkillAuthScope(org.id),
                enabled: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        // A synced skill's instructions are only exposed to users who can access
        // its source repo, even managers.
        if (!(await canAccessSkillSource(skill, { prisma, orgId: org.id }))) {
            return skillNotFound();
        }

        return toAgentSkillListItem(skill);
    }));

export const createPersonalAgentSkill = async (
    input: CreatePersonalAgentSkillInput,
    analytics?: SkillAnalyticsContext,
): Promise<AgentSkillListItem | ServiceError> => {
    const parsed = createPersonalAgentSkillInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    return sew(() =>
        withAuth(async ({ org, user, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const scope = personalAgentSkillScope(user.id, org.id);
            const { source } = parsed.data;
            const entryPoint = getSkillAnalyticsEntryPoint(analytics);
            const creationMethod = analytics?.creationMethod ?? (source ? 'repository' : 'manual');
            const eventBase: SkillEventBase<'ask_skill_created'> = {
                source: SKILL_ANALYTICS_SOURCE,
                entryPoint,
                scope: 'personal',
                creationMethod,
                isSynced: source !== undefined,
            };

            try {
                const skill = await prisma.agentSkill.create({
                    data: {
                        ...scope,
                        slug: parsed.data.slug,
                        name: parsed.data.name,
                        description: parsed.data.description,
                        instructions: parsed.data.instructions,
                        createdById: user.id,
                        updatedById: user.id,
                        // When imported from a repository file, record provenance so the
                        // skill can be synced against the indexed file. sourceBlobSha is
                        // the comparison key.
                        ...(source ? {
                            sourceRepoName: source.repoName,
                            sourceFilePath: source.filePath,
                            sourceRevision: source.revision,
                            sourceBlobSha: source.blobSha,
                            sourceImportedAt: new Date(),
                        } : {}),
                    },
                });

                refreshSkillSettingsViews();
                emitSkillEvent('ask_skill_created', {
                    ...eventBase,
                    skillIdHash: hashSkillId(skill.id),
                }, { success: true });
                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    emitSkillEvent('ask_skill_created', eventBase, {
                        success: false,
                        failureReason: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
                    });
                    return skillAlreadyExists(parsed.data.slug);
                }

                emitSkillEvent('ask_skill_created', eventBase, {
                    success: false,
                    failureReason: ErrorCode.UNEXPECTED_ERROR,
                });
                throw error;
            }
        }));
};

export const updatePersonalAgentSkill = async (
    input: UpdateAgentSkillInput,
    analytics?: SkillAnalyticsContext,
): Promise<AgentSkillListItem | ServiceError> => {
    const parsed = updateAgentSkillInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    return sew(() =>
        withAuth(async ({ org, user, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const scope = personalAgentSkillAuthScope(user.id, org.id);
            const existingSkill = await prisma.agentSkill.findFirst({
                where: {
                    id: parsed.data.id,
                    ...scope,
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    instructions: true,
                    sourceRepoName: true,
                },
            });

            if (!existingSkill) {
                return skillNotFound();
            }

            // Synced skills stay editable: local edits to description/instructions
            // persist until the user updates the skill from its source file, which
            // replaces them with the file's content.
            const isSynced = existingSkill.sourceRepoName !== null;
            const entryPoint = getSkillAnalyticsEntryPoint(analytics);
            const changedFieldTypes = getChangedFieldTypes(existingSkill, parsed.data);
            const eventBase: SkillEventBase<'ask_skill_updated'> = {
                source: SKILL_ANALYTICS_SOURCE,
                entryPoint,
                scope: 'personal',
                isSynced,
                skillIdHash: hashSkillId(existingSkill.id),
                changedFieldTypes,
            };

            try {
                const skill = await prisma.agentSkill.update({
                    where: { id: existingSkill.id },
                    data: {
                        slug: parsed.data.slug,
                        name: parsed.data.name,
                        description: parsed.data.description,
                        instructions: parsed.data.instructions,
                        updatedById: user.id,
                    },
                });

                refreshSkillSettingsViews();
                emitSkillEvent('ask_skill_updated', eventBase, { success: true });
                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    emitSkillEvent('ask_skill_updated', eventBase, {
                        success: false,
                        failureReason: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
                    });
                    return skillAlreadyExists(parsed.data.slug);
                }

                emitSkillEvent('ask_skill_updated', eventBase, {
                    success: false,
                    failureReason: ErrorCode.UNEXPECTED_ERROR,
                });
                throw error;
            }
        }));
};

type SourceFreshnessContext = { org: Org; prisma: PrismaClient };

// Compares a synced skill's stored blob OID against the current one in the indexed
// repo. Repo access goes through the user-scoped prisma, so a caller who cannot see
// the source repo degrades to repo_unavailable rather than leaking the file.
const resolveSourceStatus = async (
    skill: Pick<AgentSkill, "sourceRepoName" | "sourceFilePath" | "sourceRevision" | "sourceBlobSha">,
    context: SourceFreshnessContext,
): Promise<{ status: AgentSkillSourceStatus } | ServiceError> => {
    if (!skill.sourceRepoName || !skill.sourceFilePath || !skill.sourceRevision || !skill.sourceBlobSha) {
        return { status: "not_synced" };
    }

    const currentSha = await resolveFileBlobShaForRepo(
        { path: skill.sourceFilePath, repo: skill.sourceRepoName, ref: skill.sourceRevision },
        context,
    );

    if (isServiceError(currentSha)) {
        if (currentSha.errorCode === ErrorCode.NOT_FOUND) {
            return { status: "repo_unavailable" };
        }
        if (currentSha.errorCode === ErrorCode.UNEXPECTED_ERROR) {
            return currentSha;
        }
        // File renamed/deleted, or the imported ref no longer resolves it.
        return { status: "source_missing" };
    }

    return { status: currentSha === skill.sourceBlobSha ? "in_sync" : "update_available" };
};

type SyncedSkillSnapshot = Pick<
    AgentSkill,
    "name" | "slug" | "description" | "instructions" | "sourceRepoName" | "sourceFilePath" | "sourceRevision"
>;

// The refreshed content a sync would write, merged from the source file over the
// skill's current values: fields the file doesn't provide (no description front
// matter, empty body) keep their local values so a sync never erases content the
// file can't replace.
const mergeSourceContent = (
    skill: Pick<AgentSkill, "description" | "instructions">,
    parsedMarkdown: ParsedAgentSkillMarkdown,
): { description: string; instructions: string } => ({
    description: parsedMarkdown.description ?? skill.description,
    instructions: parsedMarkdown.instructions.length > 0 ? parsedMarkdown.instructions : skill.instructions,
});

// Re-reads a synced skill's source file and validates the refreshed content against
// its preserved labels, returning the columns to write. The name and slug are local
// labels (passed in, never overwritten); only description, instructions, and the
// blob OID come from the file, with absent fields keeping their current values.
const buildSourceRefreshData = async (
    skill: SyncedSkillSnapshot,
    context: SourceFreshnessContext,
): Promise<{ description: string; instructions: string; sourceBlobSha: string } | ServiceError> => {
    if (!skill.sourceRepoName || !skill.sourceFilePath || !skill.sourceRevision) {
        return skillNotSynced();
    }

    const fileResult = await getFileSourceForRepo(
        { path: skill.sourceFilePath, repo: skill.sourceRepoName, ref: skill.sourceRevision },
        context,
    );

    if (isServiceError(fileResult)) {
        return fileResult;
    }

    if (!fileResult.blobSha) {
        return unexpectedError("Could not determine the source file version.");
    }

    const fileName = skill.sourceFilePath.split("/").pop();
    const parsedMarkdown = parseAgentSkillMarkdown(fileResult.source, fileName);

    const candidate = agentSkillInputSchema.safeParse({
        name: skill.name,
        slug: skill.slug,
        ...mergeSourceContent(skill, parsedMarkdown),
    });

    if (!candidate.success) {
        return skillSourceInvalid();
    }

    return {
        description: candidate.data.description,
        instructions: candidate.data.instructions,
        sourceBlobSha: fileResult.blobSha,
    };
};

// Reports whether a synced skill's source file has changed since import. Read-only,
// so it accepts either the caller's own personal skill or a shared skill visible
// to the caller; repo access stays user-scoped (see resolveSourceStatus).
export const getAgentSkillSourceStatus = async (
    skillId: string,
): Promise<{ status: AgentSkillSourceStatus } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                OR: [
                    personalAgentSkillAuthScope(user.id, org.id),
                    sharedAgentSkillVisibleToUserWhere(user.id, org.id),
                ],
            },
            select: {
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
                sourceBlobSha: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        return resolveSourceStatus(skill, { org, prisma });
    }));

// Computes what applying "update from source" right now would do, without writing
// anything: which fields would change, and which of those changes would overwrite
// local edits. Local edits are detected on demand by re-reading the originally
// imported file version (by its stored blob OID) and comparing it to the skill's
// current content — nothing extra is persisted. If the imported blob is no longer
// readable (e.g. pruned after an upstream force-push), every field the sync would
// change is conservatively reported as a local edit.
export const getAgentSkillSyncPreview = async (
    skillId: string,
): Promise<AgentSkillSyncPreview | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                OR: [
                    personalAgentSkillAuthScope(user.id, org.id),
                    sharedAgentSkillVisibleToUserWhere(user.id, org.id),
                ],
            },
            select: {
                description: true,
                instructions: true,
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
                sourceBlobSha: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        if (!skill.sourceRepoName || !skill.sourceFilePath || !skill.sourceRevision || !skill.sourceBlobSha) {
            return skillNotSynced();
        }

        const fileResult = await getFileSourceForRepo(
            { path: skill.sourceFilePath, repo: skill.sourceRepoName, ref: skill.sourceRevision },
            { org, prisma },
        );

        if (isServiceError(fileResult)) {
            return fileResult;
        }

        if (!fileResult.blobSha) {
            return unexpectedError("Could not determine the source file version.");
        }

        const status: AgentSkillSourceStatus = fileResult.blobSha === skill.sourceBlobSha
            ? "in_sync"
            : "update_available";

        const fileName = skill.sourceFilePath.split("/").pop();
        const merged = mergeSourceContent(skill, parseAgentSkillMarkdown(fileResult.source, fileName));

        const changedFields: AgentSkillSyncField[] = [];
        if (merged.description !== skill.description) {
            changedFields.push("description");
        }
        if (merged.instructions !== skill.instructions) {
            changedFields.push("instructions");
        }

        if (changedFields.length === 0) {
            return { status, changedFields, overwrittenLocalEdits: [] };
        }

        const importedContent = await getBlobContentForRepo(
            { repo: skill.sourceRepoName, blobSha: skill.sourceBlobSha },
            { org, prisma },
        );

        if (isServiceError(importedContent)) {
            return { status, changedFields, overwrittenLocalEdits: changedFields };
        }

        // A field counts as locally edited when its current value differs from what
        // the imported file version supplied. The description baseline uses "" for
        // an absent front-matter description: a non-empty local value can then only
        // have come from the user (typed at import time or edited later).
        const imported = parseAgentSkillMarkdown(importedContent, fileName);
        const overwrittenLocalEdits = changedFields.filter((field) => field === "description"
            ? skill.description !== (imported.description ?? "")
            : skill.instructions !== imported.instructions);

        return { status, changedFields, overwrittenLocalEdits };
    }));

// Re-imports a synced personal skill's content from its source file, refreshing
// description/instructions and the stored blob OID. Name and slug are preserved so
// the skill's label and /command stay stable.
export const updatePersonalAgentSkillFromSource = async (
    skillId: string,
    analytics?: SkillAnalyticsContext,
): Promise<AgentSkillListItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...personalAgentSkillAuthScope(user.id, org.id),
            },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                instructions: true,
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        const entryPoint = getSkillAnalyticsEntryPoint(analytics);
        const eventBase: SkillEventBase<'ask_skill_source_refresh_completed'> = {
            source: SKILL_ANALYTICS_SOURCE,
            entryPoint,
            scope: 'personal',
            skillIdHash: hashSkillId(skill.id),
        };
        const refresh = await buildSourceRefreshData(skill, { org, prisma });
        if (isServiceError(refresh)) {
            emitSkillEvent('ask_skill_source_refresh_completed', eventBase, {
                success: false,
                failureReason: getSkillFailureReason(refresh),
            });
            return refresh;
        }

        let updated: AgentSkill;
        try {
            updated = await prisma.agentSkill.update({
                where: { id: skill.id },
                data: {
                    description: refresh.description,
                    instructions: refresh.instructions,
                    sourceBlobSha: refresh.sourceBlobSha,
                    sourceImportedAt: new Date(),
                    updatedById: user.id,
                },
            });
        } catch (error) {
            emitSkillEvent('ask_skill_source_refresh_completed', eventBase, {
                success: false,
                failureReason: ErrorCode.UNEXPECTED_ERROR,
            });
            throw error;
        }

        refreshSkillSettingsViews();
        emitSkillEvent('ask_skill_source_refresh_completed', eventBase, { success: true });
        return toAgentSkillListItem(updated);
    }));

// Re-imports a synced shared skill's content from its source file. Restricted to the
// skill's author or an org owner, since the refresh updates the org-wide command for
// everyone who has it enabled.
export const updateSharedAgentSkillFromSource = async (
    skillId: string,
    analytics?: SkillAnalyticsContext,
): Promise<SharedAgentSkillCatalogItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const manageable = await requireManageableSharedSkill({
            prisma,
            orgId: org.id,
            userId: user.id,
            role,
            skillId,
            requireEnabled: true,
        });

        if ("errorCode" in manageable) {
            return manageable;
        }

        const entryPoint = getSkillAnalyticsEntryPoint(analytics);

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: manageable.id,
                ...sharedAgentSkillAuthScope(org.id),
                enabled: true,
            },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                instructions: true,
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        const eventBase: SkillEventBase<'ask_skill_source_refresh_completed'> = {
            source: SKILL_ANALYTICS_SOURCE,
            entryPoint,
            scope: 'shared',
            skillIdHash: hashSkillId(skill.id),
        };
        const refresh = await buildSourceRefreshData(skill, { org, prisma });
        if (isServiceError(refresh)) {
            emitSkillEvent('ask_skill_source_refresh_completed', eventBase, {
                success: false,
                failureReason: getSkillFailureReason(refresh),
            });
            return refresh;
        }

        const updated = await (async () => {
            try {
                return await prisma.agentSkill.update({
                    where: { id: skill.id },
                    data: {
                        description: refresh.description,
                        instructions: refresh.instructions,
                        sourceBlobSha: refresh.sourceBlobSha,
                        sourceImportedAt: new Date(),
                        updatedById: user.id,
                    },
                    select: sharedCatalogSkillSelect(user.id, org.id),
                });
            } catch (error) {
                emitSkillEvent('ask_skill_source_refresh_completed', eventBase, {
                    success: false,
                    failureReason: ErrorCode.UNEXPECTED_ERROR,
                });
                throw error;
            }
        })();

        refreshSkillSettingsViews();
        emitSkillEvent('ask_skill_source_refresh_completed', eventBase, { success: true });
        return toSharedAgentSkillCatalogItem(updated, user.id);
    }));

export const deletePersonalAgentSkill = async (
    skillId: string,
    analytics?: SkillAnalyticsContext,
): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        let skill: Pick<AgentSkill, "id" | "sourceRepoName">;
        try {
            skill = await prisma.agentSkill.delete({
                where: {
                    id: skillId,
                    ...personalAgentSkillAuthScope(user.id, org.id),
                },
                select: {
                    id: true,
                    sourceRepoName: true,
                },
            });
        } catch (error) {
            if (isRecordNotFoundError(error)) {
                return skillNotFound();
            }
            throw error;
        }

        refreshSkillSettingsViews();
        emitSkillEvent('ask_skill_deleted', {
            source: SKILL_ANALYTICS_SOURCE,
            entryPoint: getSkillAnalyticsEntryPoint(analytics),
            scope: 'personal',
            isSynced: isSyncedSkill(skill),
            skillIdHash: hashSkillId(skill.id),
            actorRelationship: 'creator',
        }, { success: true });
        return { success: true };
    }));

export const publishPersonalAgentSkillToShared = async (
    skillId: string,
    analytics?: SkillAnalyticsContext,
): Promise<SharedAgentSkillCatalogItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const personalSkill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...personalAgentSkillAuthScope(user.id, org.id),
            },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                instructions: true,
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
                sourceBlobSha: true,
                sourceImportedAt: true,
            },
        });

        if (!personalSkill) {
            return skillNotFound();
        }

        const entryPoint = getSkillAnalyticsEntryPoint(analytics);
        const isSynced = isSyncedSkill(personalSkill);
        const permissionSyncEnabled = env.PERMISSION_SYNC_ENABLED === 'true';
        const eventBase: SkillEventBase<'ask_skill_shared'> = {
            source: SKILL_ANALYTICS_SOURCE,
            entryPoint,
            isSynced,
            skillIdHash: hashSkillId(personalSkill.id),
            permissionSyncEnabled,
            requiredRepoAccessWarning: isSynced && permissionSyncEnabled,
        };
        try {
            const sharedSkill = await prisma.$transaction(async (tx) => {
                const createdSkill = await tx.agentSkill.create({
                    data: sharedSkillCreateDataForUser({
                        orgId: org.id,
                        userId: user.id,
                        skill: personalSkill,
                        source: isSynced ? personalSkill : null,
                    }),
                    select: {
                        id: true,
                    },
                });

                await tx.agentSkill.delete({
                    where: {
                        id: skillId,
                    },
                });

                const selectedSkill = await tx.agentSkill.findFirst({
                    where: {
                        id: createdSkill.id,
                        ...sharedAgentSkillAuthScope(org.id),
                    },
                    select: sharedCatalogSkillSelect(user.id, org.id),
                });

                if (!selectedSkill) {
                    throw new Error("Created shared skill was not found.");
                }

                return selectedSkill;
            });

            refreshSkillSettingsViews();
            emitSkillEvent('ask_skill_shared', {
                ...eventBase,
                skillIdHash: hashSkillId(sharedSkill.id),
            }, { success: true });
            return toSharedAgentSkillCatalogItem(sharedSkill, user.id);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                emitSkillEvent('ask_skill_shared', eventBase, {
                    success: false,
                    failureReason: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
                });
                return skillAlreadyExists(personalSkill.slug);
            }

            emitSkillEvent('ask_skill_shared', eventBase, {
                success: false,
                failureReason: ErrorCode.UNEXPECTED_ERROR,
            });
            throw error;
        }
    }));

export const makeSharedAgentSkillPersonal = async (
    skillId: string,
    analytics?: SkillAnalyticsContext,
): Promise<AgentSkillListItem | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const sharedSkill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...sharedAgentSkillAuthScope(org.id),
                enabled: true,
            },
            select: {
                id: true,
                slug: true,
                name: true,
                description: true,
                instructions: true,
                createdById: true,
                autoEnrolled: true,
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
                sourceBlobSha: true,
                sourceImportedAt: true,
            },
        });

        if (!sharedSkill) {
            return skillNotFound();
        }

        if (!canManageSharedSkill(sharedSkill, user.id, role)) {
            const visibleSkill = await prisma.agentSkill.findFirst({
                where: {
                    id: skillId,
                    ...sharedAgentSkillVisibleToUserWhere(user.id, org.id),
                },
                select: {
                    id: true,
                },
            });

            if (!visibleSkill) {
                return insufficientSkillPermissions();
            }
        }

        const entryPoint = getSkillAnalyticsEntryPoint(analytics);
        const actorRelationship = getSharedSkillActorRelationship(sharedSkill, user.id, role);
        const isSynced = isSyncedSkill(sharedSkill);
        const eventBase: SkillEventBase<'ask_skill_made_personal'> = {
            source: SKILL_ANALYTICS_SOURCE,
            entryPoint,
            isSynced,
            wasAutoEnrolled: sharedSkill.autoEnrolled,
            skillIdHash: hashSkillId(sharedSkill.id),
            actorRelationship,
        };
        try {
            const personalSkill = await prisma.$transaction(async (tx) => {
                const createdSkill = await tx.agentSkill.create({
                    data: {
                        ...personalAgentSkillScope(user.id, org.id),
                        slug: sharedSkill.slug,
                        name: sharedSkill.name,
                        description: sharedSkill.description,
                        instructions: sharedSkill.instructions,
                        createdById: user.id,
                        updatedById: user.id,
                        // Preserve the repository link so a synced skill stays
                        // synced when pulled back to personal.
                        ...sourceColumnsCarryOver(sharedSkill),
                    },
                });

                if (sharedSkill.createdById === user.id) {
                    await tx.agentSkill.delete({
                        where: {
                            id: sharedSkill.id,
                        },
                    });
                } else {
                    await removeSharedSkillForUser({
                        prisma: tx,
                        orgId: org.id,
                        userId: user.id,
                        skill: sharedSkill,
                    });
                }

                return createdSkill;
            });

            refreshSkillSettingsViews();
            emitSkillEvent('ask_skill_made_personal', eventBase, { success: true });
            return toAgentSkillListItem(personalSkill);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                emitSkillEvent('ask_skill_made_personal', eventBase, {
                    success: false,
                    failureReason: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
                });
                return skillAlreadyExists(sharedSkill.slug);
            }

            emitSkillEvent('ask_skill_made_personal', eventBase, {
                success: false,
                failureReason: ErrorCode.UNEXPECTED_ERROR,
            });
            throw error;
        }
    }));

export const listSharedAgentSkillCatalog = async (): Promise<SharedAgentSkillCatalogItem[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skills = await prisma.agentSkill.findMany({
            where: {
                ...sharedAgentSkillAuthScope(org.id),
                enabled: true,
            },
            orderBy: agentSkillOrderBy,
            select: sharedCatalogSkillSelect(user.id, org.id),
        });

        // Hide shared skills synced from a repo the user can't access, so their
        // instructions are not exposed org-wide. (Owners retain a management path
        // via listSharedAgentSkillManagement, which carries no instructions.)
        const accessibleSkills = await filterSkillsBySourceRepoAccess(skills, { prisma, orgId: org.id });

        return accessibleSkills.map((skill) => toSharedAgentSkillCatalogItem(skill, user.id));
    }));

export const listSharedAgentSkillManagement = async (): Promise<SharedAgentSkillManagementItem[] | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const skills = await prisma.agentSkill.findMany({
                where: {
                    ...sharedAgentSkillAuthScope(org.id),
                    enabled: true,
                },
                orderBy: agentSkillOrderBy,
                select: sharedManagementSkillSelect,
            });

            return skills.map(toSharedAgentSkillManagementItem);
        });
    }));

export const listSharedAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        return listSharedAgentSkillCommandsForContext({ prisma, userId: user.id, orgId: org.id });
    }));

export const listAgentSkillCommands = async (): Promise<AskCommandDefinition[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const [personalCommands, sharedCommands] = await Promise.all([
            listPersonalAgentSkillCommandsForContext({ prisma, userId: user.id, orgId: org.id }),
            listSharedAgentSkillCommandsForContext({ prisma, userId: user.id, orgId: org.id }),
        ]);

        return [
            ...personalCommands,
            ...sharedCommands,
        ];
    }));

export const createSharedAgentSkill = async (
    input: AgentSkillInput,
    analytics?: SkillAnalyticsContext,
): Promise<AgentSkillListItem | ServiceError> => {
    const parsed = agentSkillInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    return sew(() =>
        withAuth(async ({ org, user, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const entryPoint = getSkillAnalyticsEntryPoint(analytics);
            const creationMethod = analytics?.creationMethod ?? 'manual';
            const eventBase: SkillEventBase<'ask_skill_created'> = {
                source: SKILL_ANALYTICS_SOURCE,
                entryPoint,
                scope: 'shared',
                creationMethod,
                isSynced: false,
            };
            try {
                const skill = await prisma.$transaction(async (tx) => {
                    return createSharedSkillForUser({
                        prisma: tx,
                        orgId: org.id,
                        userId: user.id,
                        skill: parsed.data,
                    });
                });

                refreshSkillSettingsViews();
                emitSkillEvent('ask_skill_created', {
                    ...eventBase,
                    skillIdHash: hashSkillId(skill.id),
                }, { success: true });
                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    emitSkillEvent('ask_skill_created', eventBase, {
                        success: false,
                        failureReason: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
                    });
                    return skillAlreadyExists(parsed.data.slug);
                }

                emitSkillEvent('ask_skill_created', eventBase, {
                    success: false,
                    failureReason: ErrorCode.UNEXPECTED_ERROR,
                });
                throw error;
            }
        }));
};

export const updateSharedAgentSkill = async (
    input: UpdateAgentSkillInput,
    analytics?: SkillAnalyticsContext,
): Promise<AgentSkillListItem | ServiceError> => {
    const parsed = updateAgentSkillInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    return sew(() =>
        withAuth(async ({ org, user, role, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            const existingSkill = await requireManageableSharedSkill({
                prisma,
                orgId: org.id,
                userId: user.id,
                role,
                skillId: parsed.data.id,
                requireEnabled: true,
                includeUpdateSnapshot: true,
            });

            if ("errorCode" in existingSkill) {
                return existingSkill;
            }

            // As with personal skills, a synced shared skill stays editable; local
            // edits persist until an update from source replaces them.
            const isSynced = existingSkill.sourceRepoName !== null;
            const entryPoint = getSkillAnalyticsEntryPoint(analytics);
            const changedFieldTypes = getChangedFieldTypes(existingSkill, parsed.data);
            const eventBase: SkillEventBase<'ask_skill_updated'> = {
                source: SKILL_ANALYTICS_SOURCE,
                entryPoint,
                scope: 'shared',
                isSynced,
                skillIdHash: hashSkillId(existingSkill.id),
                changedFieldTypes,
            };

            try {
                const skill = await prisma.agentSkill.update({
                    where: { id: existingSkill.id },
                    data: {
                        slug: parsed.data.slug,
                        name: parsed.data.name,
                        description: parsed.data.description,
                        instructions: parsed.data.instructions,
                        updatedById: user.id,
                    },
                });

                refreshSkillSettingsViews();
                emitSkillEvent('ask_skill_updated', eventBase, { success: true });
                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    emitSkillEvent('ask_skill_updated', eventBase, {
                        success: false,
                        failureReason: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
                    });
                    return skillAlreadyExists(parsed.data.slug);
                }

                emitSkillEvent('ask_skill_updated', eventBase, {
                    success: false,
                    failureReason: ErrorCode.UNEXPECTED_ERROR,
                });
                throw error;
            }
        }));
};

export const deleteSharedAgentSkill = async (
    skillId: string,
    analytics?: SkillAnalyticsContext,
): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const existingSkill = await requireManageableSharedSkill({
            prisma,
            orgId: org.id,
            userId: user.id,
            role,
            skillId,
            requireEnabled: true,
        });

        if ("errorCode" in existingSkill) {
            return existingSkill;
        }

        await prisma.agentSkill.delete({
            where: { id: existingSkill.id },
        });

        refreshSkillSettingsViews();
        emitSkillEvent('ask_skill_deleted', {
            source: SKILL_ANALYTICS_SOURCE,
            entryPoint: getSkillAnalyticsEntryPoint(analytics),
            scope: 'shared',
            isSynced: isSyncedSkill(existingSkill),
            skillIdHash: hashSkillId(existingSkill.id),
            actorRelationship: getSharedSkillActorRelationship(existingSkill, user.id, role),
        }, { success: true });
        return { success: true };
    }));

export const setSharedSkillFlag = async (
    input: SharedSkillFlagInput,
    analytics?: SkillAnalyticsContext,
): Promise<SharedAgentSkillManagementItem | ServiceError> => {
    const parsed = sharedSkillFlagInputSchema.safeParse(input);
    if (!parsed.success) {
        return requestBodySchemaValidationError(parsed.error);
    }

    const { skillId, data } = parsed.data;

    return sew(() =>
        withAuth(async ({ org, user, role, prisma }) => {
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

            return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
                const existingSkill = await prisma.agentSkill.findFirst({
                    where: {
                        id: skillId,
                        ...sharedAgentSkillAuthScope(org.id),
                    },
                    select: {
                        id: true,
                        sourceRepoName: true,
                    },
                });

                if (!existingSkill) {
                    return skillNotFound();
                }

                const skill = await prisma.agentSkill.update({
                    where: { id: existingSkill.id },
                    data: {
                        ...data,
                        updatedById: user.id,
                    },
                    select: sharedManagementSkillSelect,
                });

                refreshSkillSettingsViews();
                if (data.autoEnrolled !== undefined) {
                    void captureEvent('ask_skill_auto_enrollment_changed', {
                        source: SKILL_ANALYTICS_SOURCE,
                        entryPoint: getSkillAnalyticsEntryPoint(analytics),
                        enabled: data.autoEnrolled,
                        isSynced: isSyncedSkill(existingSkill),
                        skillIdHash: hashSkillId(existingSkill.id),
                        success: true,
                    });
                }
                return toSharedAgentSkillManagementItem(skill);
            });
        }));
};

export const adoptSharedSkill = async (
    skillId: string,
    analytics?: SkillAnalyticsContext,
): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...sharedAgentSkillAuthScope(org.id),
                enabled: true,
            },
            select: {
                id: true,
                sourceRepoName: true,
                autoEnrolled: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        // Don't let a user enable a skill synced from a repo they can't access.
        if (!(await canAccessSkillSource(skill, { prisma, orgId: org.id }))) {
            return skillNotFound();
        }

        await prisma.agentSkillAdoption.upsert({
            where: {
                orgId_userId_agentSkillId: {
                    orgId: org.id,
                    userId: user.id,
                    agentSkillId: skill.id,
                },
            },
            create: {
                orgId: org.id,
                userId: user.id,
                agentSkillId: skill.id,
                removedAt: null,
            },
            update: {
                removedAt: null,
            },
        });

        refreshSkillSettingsViews();
        void captureEvent('ask_skill_adoption_changed', {
            source: SKILL_ANALYTICS_SOURCE,
            entryPoint: getSkillAnalyticsEntryPoint(analytics),
            action: 'adopted',
            isSynced: isSyncedSkill(skill),
            autoEnrolled: skill.autoEnrolled,
            skillIdHash: hashSkillId(skill.id),
            success: true,
        });
        return { success: true };
    }));

export const unadoptSharedSkill = async (
    skillId: string,
    analytics?: SkillAnalyticsContext,
): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const skill = await prisma.agentSkill.findFirst({
            where: {
                id: skillId,
                ...sharedAgentSkillAuthScope(org.id),
            },
            select: {
                id: true,
                autoEnrolled: true,
                sourceRepoName: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        await removeSharedSkillForUser({
            prisma,
            orgId: org.id,
            userId: user.id,
            skill,
        });

        refreshSkillSettingsViews();
        void captureEvent('ask_skill_adoption_changed', {
            source: SKILL_ANALYTICS_SOURCE,
            entryPoint: getSkillAnalyticsEntryPoint(analytics),
            action: 'removed',
            isSynced: isSyncedSkill(skill),
            autoEnrolled: skill.autoEnrolled,
            skillIdHash: hashSkillId(skill.id),
            success: true,
        });
        return { success: true };
    }));
