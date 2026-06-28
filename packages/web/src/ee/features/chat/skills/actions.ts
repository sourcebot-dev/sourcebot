'use server';

import { checkAskEntitlement } from "@/features/chat/utils.server";
import { type AskCommandDefinition } from "@/features/chat/commands/types";
import { getFileSourceForRepo, resolveFileBlobShaForRepo } from "@/features/git";
import { ErrorCode } from "@/lib/errorCodes";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { requestBodySchemaValidationError, unexpectedError, ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole, Prisma, sharedAgentSkillAuthScope, sharedAgentSkillScope, sharedAgentSkillVisibleToUserWhere, personalAgentSkillAuthScope, personalAgentSkillScope, type AgentSkill, type Org, type PrismaClient } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
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
    type CreatePersonalAgentSkillInput,
    type SharedAgentSkillCatalogItem,
    type SharedAgentSkillManagementItem,
    type UpdateAgentSkillInput,
} from "./types";
import {
    listSharedAgentSkillCommandsForContext,
    listPersonalAgentSkillCommandsForContext,
} from "./commandCatalog";
import { canAccessSkillSource, filterSkillsBySourceRepoAccess } from "./sourceRepoAccess";

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
} satisfies Prisma.AgentSkillSelect;

type AgentSkillWriteClient = Pick<PrismaClient, "agentSkill" | "agentSkillAdoption">;
type ManageableSharedSkill = {
    id: string;
    createdById: string;
    sourceRepoName: string | null;
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

const requireManageableSharedSkill = async ({
    prisma,
    orgId,
    userId,
    role,
    skillId,
    requireEnabled = true,
}: {
    prisma: PrismaClient;
    orgId: number;
    userId: string;
    role: OrgRole;
    skillId: string;
    requireEnabled?: boolean;
}): Promise<ManageableSharedSkill | ServiceError> => {
    const skill = await prisma.agentSkill.findFirst({
        where: {
            id: skillId,
            ...sharedAgentSkillAuthScope(orgId),
            ...(requireEnabled ? { enabled: true } : {}),
        },
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
};

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
                        // skill is a read-only mirror that can be synced against the
                        // indexed file. sourceBlobSha is the comparison key.
                        ...(source ? {
                            sourceRepoName: source.repoName,
                            sourceFilePath: source.filePath,
                            sourceRevision: source.revision,
                            sourceBlobSha: source.blobSha,
                            sourceImportedAt: new Date(),
                        } : {}),
                    },
                });

                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    return skillAlreadyExists(parsed.data.slug);
                }

                throw error;
            }
        }));
};

export const updatePersonalAgentSkill = async (
    input: UpdateAgentSkillInput,
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
                select: { id: true, sourceRepoName: true },
            });

            if (!existingSkill) {
                return skillNotFound();
            }

            // For skills imported from a repository, the description and instructions
            // stay synced with the source file (refreshed via
            // updatePersonalAgentSkillFromSource), so only the local labels — name and
            // command — are editable here. Content changes from the client are ignored.
            const isSynced = existingSkill.sourceRepoName !== null;

            try {
                const skill = await prisma.agentSkill.update({
                    where: { id: existingSkill.id },
                    data: isSynced
                        ? {
                            slug: parsed.data.slug,
                            name: parsed.data.name,
                            updatedById: user.id,
                        }
                        : {
                            slug: parsed.data.slug,
                            name: parsed.data.name,
                            description: parsed.data.description,
                            instructions: parsed.data.instructions,
                            updatedById: user.id,
                        },
                });

                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    return skillAlreadyExists(parsed.data.slug);
                }

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

// Re-reads a synced skill's source file and validates the refreshed content against
// its preserved labels, returning the columns to write. The name and slug are local
// labels (passed in, never overwritten); only description, instructions, and the
// blob OID come from the file.
const buildSourceRefreshData = async (
    skill: Pick<AgentSkill, "name" | "slug" | "sourceRepoName" | "sourceFilePath" | "sourceRevision">,
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
        description: parsedMarkdown.description ?? "",
        instructions: parsedMarkdown.instructions,
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
// so it accepts either the caller's own personal skill or any shared skill visible
// in the org; repo access stays user-scoped (see resolveSourceStatus).
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
                    { ...sharedAgentSkillAuthScope(org.id), enabled: true },
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

// Re-imports a synced personal skill's content from its source file, refreshing
// description/instructions and the stored blob OID. Name and slug are preserved so
// the skill's label and /command stay stable.
export const updatePersonalAgentSkillFromSource = async (
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
            select: {
                id: true,
                name: true,
                slug: true,
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        const refresh = await buildSourceRefreshData(skill, { org, prisma });
        if (isServiceError(refresh)) {
            return refresh;
        }

        const updated = await prisma.agentSkill.update({
            where: { id: skill.id },
            data: {
                description: refresh.description,
                instructions: refresh.instructions,
                sourceBlobSha: refresh.sourceBlobSha,
                sourceImportedAt: new Date(),
                updatedById: user.id,
            },
        });

        return toAgentSkillListItem(updated);
    }));

// Re-imports a synced shared skill's content from its source file. Restricted to the
// skill's author or an org owner, since the refresh updates the org-wide command for
// everyone who has it enabled.
export const updateSharedAgentSkillFromSource = async (
    skillId: string,
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
                sourceRepoName: true,
                sourceFilePath: true,
                sourceRevision: true,
            },
        });

        if (!skill) {
            return skillNotFound();
        }

        const refresh = await buildSourceRefreshData(skill, { org, prisma });
        if (isServiceError(refresh)) {
            return refresh;
        }

        const updated = await prisma.agentSkill.update({
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

        return toSharedAgentSkillCatalogItem(updated, user.id);
    }));

export const deletePersonalAgentSkill = async (
    skillId: string,
): Promise<{ success: true } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const result = await prisma.agentSkill.deleteMany({
            where: {
                id: skillId,
                ...personalAgentSkillAuthScope(user.id, org.id),
            },
        });

        if (result.count === 0) {
            return skillNotFound();
        }

        return { success: true };
    }));

export const publishPersonalAgentSkillToShared = async (
    skillId: string,
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

        try {
            const sharedSkill = await prisma.$transaction(async (tx) => {
                const createdSkill = await tx.agentSkill.create({
                    data: sharedSkillCreateDataForUser({
                        orgId: org.id,
                        userId: user.id,
                        skill: personalSkill,
                        source: personalSkill,
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

            return toSharedAgentSkillCatalogItem(sharedSkill, user.id);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                return skillAlreadyExists(personalSkill.slug);
            }

            throw error;
        }
    }));

export const makeSharedAgentSkillPersonal = async (
    skillId: string,
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

            return toAgentSkillListItem(personalSkill);
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                return skillAlreadyExists(sharedSkill.slug);
            }

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

            try {
                const skill = await prisma.$transaction(async (tx) => {
                    return createSharedSkillForUser({
                        prisma: tx,
                        orgId: org.id,
                        userId: user.id,
                        skill: parsed.data,
                    });
                });

                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    return skillAlreadyExists(parsed.data.slug);
                }

                throw error;
            }
        }));
};

export const updateSharedAgentSkill = async (
    input: UpdateAgentSkillInput,
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
            });

            if ("errorCode" in existingSkill) {
                return existingSkill;
            }

            // As with personal skills, a synced skill's description and
            // instructions track the source file, so only its name and command are
            // editable here; content changes from the client are ignored.
            const isSynced = existingSkill.sourceRepoName !== null;

            try {
                const skill = await prisma.agentSkill.update({
                    where: { id: existingSkill.id },
                    data: isSynced
                        ? {
                            slug: parsed.data.slug,
                            name: parsed.data.name,
                            updatedById: user.id,
                        }
                        : {
                            slug: parsed.data.slug,
                            name: parsed.data.name,
                            description: parsed.data.description,
                            instructions: parsed.data.instructions,
                            updatedById: user.id,
                        },
                });

                return toAgentSkillListItem(skill);
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    return skillAlreadyExists(parsed.data.slug);
                }

                throw error;
            }
        }));
};

export const deleteSharedAgentSkill = async (
    skillId: string,
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

        return { success: true };
    }));

export const setSharedSkillFlag = async (
    input: SharedSkillFlagInput,
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

                return toSharedAgentSkillManagementItem(skill);
            });
        }));
};

export const adoptSharedSkill = async (
    skillId: string,
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

        return { success: true };
    }));

export const unadoptSharedSkill = async (
    skillId: string,
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

        return { success: true };
    }));
