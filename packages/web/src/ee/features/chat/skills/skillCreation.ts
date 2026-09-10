import { ErrorCode } from "@/lib/errorCodes";
import { captureEvent } from "@/lib/posthog";
import type {
    AskSkillAnalyticsSource,
    AskSkillChangedField,
    AskSkillCreationMethod,
    AskSkillEntryPoint,
    AskSkillScope,
    PosthogEventMap,
} from "@/lib/posthogEvents";
import { isUniqueConstraintError } from "@/lib/prismaErrors";
import { requestBodySchemaValidationError, ServiceError } from "@/lib/serviceError";
import { OrgRole, personalAgentSkillAuthScope, personalAgentSkillScope, sharedAgentSkillAuthScope, type AgentSkill, type PrismaClient } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import {
    agentSkillInputSchema,
    toAgentSkillListItem,
    type AgentSkillInput,
    type AgentSkillListItem,
    type CreatePersonalAgentSkillInput,
} from "./types";
import { hashSkillId } from "./skillAnalytics";

// The creation, update, and analytics cores shared by the skill server actions
// and the agent-facing skill tools. Everything here runs inside the caller's
// auth context: no auth, no entitlement checks, and no `next/cache` calls
// (route handlers cannot call `refresh()`; only the server actions do).

export const skillAlreadyExists = (slug: string): ServiceError => ({
    statusCode: StatusCodes.CONFLICT,
    errorCode: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
    message: `A skill with command /${slug} already exists.`,
});

export const skillNotFound = (): ServiceError => ({
    statusCode: StatusCodes.NOT_FOUND,
    errorCode: ErrorCode.AGENT_SKILL_NOT_FOUND,
    message: "Skill not found.",
});

export const insufficientSkillPermissions = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message: "You do not have sufficient permissions to manage this skill.",
});

export const syncedSkillNotEditable = (repoName: string): ServiceError => ({
    statusCode: StatusCodes.BAD_REQUEST,
    errorCode: ErrorCode.INVALID_REQUEST_BODY,
    message: `This skill is synced from ${repoName} and cannot be edited here. It can be edited in Settings → Skills, where it will stay linked to its source file.`,
});

export type SkillOutcomeEventName = {
    [EventName in keyof PosthogEventMap]: PosthogEventMap[EventName] extends { success: boolean }
        ? EventName
        : never;
}[keyof PosthogEventMap];
export type SkillEventBase<EventName extends SkillOutcomeEventName> =
    Omit<PosthogEventMap[EventName], "success" | "failureReason">;
export type SkillEventOutcome =
    | { success: true }
    | { success: false; failureReason: string };

export const emitSkillEvent = <EventName extends SkillOutcomeEventName>(
    eventName: EventName,
    base: SkillEventBase<EventName>,
    outcome: SkillEventOutcome,
) => {
    void captureEvent(eventName, {
        ...base,
        ...outcome,
    } as PosthogEventMap[EventName]);
};

export const canManageSharedSkill = (
    skill: { createdById: string },
    userId: string,
    role: OrgRole,
) => skill.createdById === userId || role === OrgRole.OWNER;

export const getChangedFieldTypes = (
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

export type SkillMutationAnalytics = {
    source: AskSkillAnalyticsSource;
    entryPoint: AskSkillEntryPoint;
};

/**
 * Creates an enabled personal skill for the given user in the given org, emits
 * `ask_skill_created`, and maps unique-constraint violations to the
 * already-exists error. `input` must already be parsed (slug normalized).
 */
export const createPersonalAgentSkillForContext = async ({
    prisma,
    userId,
    orgId,
    input,
    analytics,
}: {
    prisma: PrismaClient;
    userId: string;
    orgId: number;
    input: CreatePersonalAgentSkillInput;
    analytics: SkillMutationAnalytics & { creationMethod: AskSkillCreationMethod };
}): Promise<AgentSkillListItem | ServiceError> => {
    const { source } = input;
    const eventBase: SkillEventBase<'ask_skill_created'> = {
        source: analytics.source,
        entryPoint: analytics.entryPoint,
        scope: 'personal',
        creationMethod: analytics.creationMethod,
        isSynced: source !== undefined,
    };

    try {
        const skill = await prisma.agentSkill.create({
            data: {
                ...personalAgentSkillScope(userId, orgId),
                slug: input.slug,
                name: input.name,
                description: input.description,
                instructions: input.instructions,
                createdById: userId,
                updatedById: userId,
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
            return skillAlreadyExists(input.slug);
        }

        emitSkillEvent('ask_skill_created', eventBase, {
            success: false,
            failureReason: ErrorCode.UNEXPECTED_ERROR,
        });
        throw error;
    }
};

// The skill row an update resolves against, identified either by id (the
// settings actions) or by its current slug (the agent tool).
export type UpdateAgentSkillTarget = {
    scope: AskSkillScope;
} & ({ id: string; slug?: undefined } | { slug: string; id?: undefined });

export type UpdateAgentSkillPolicy = {
    // Who may edit a shared skill. The settings actions allow the creator or an
    // org owner (requires `role`); the agent tool restricts to the creator.
    sharedManageableBy: 'creator' | 'creator-or-owner';
    // Whether repo-synced skills may be edited. The settings actions allow it
    // (local edits persist until a sync); the agent tool rejects it so synced
    // skills stay synced unless a human intervenes in Settings → Skills.
    allowSynced: boolean;
};

/**
 * The scope-aware update core behind `updatePersonalAgentSkill`,
 * `updateSharedAgentSkill`, and the `update_skill` tool. Resolves the target
 * row, enforces the caller's policy, merges `fields` over the existing values,
 * validates the merged result, performs the update, and emits
 * `ask_skill_updated`. Never changes `enabled` or the skill's scope.
 */
export const updateAgentSkillForContext = async ({
    prisma,
    userId,
    orgId,
    role,
    target,
    fields,
    policy,
    analytics,
}: {
    prisma: PrismaClient;
    userId: string;
    orgId: number;
    // Required when policy.sharedManageableBy is 'creator-or-owner'.
    role?: OrgRole;
    target: UpdateAgentSkillTarget;
    fields: Partial<AgentSkillInput>;
    policy: UpdateAgentSkillPolicy;
    analytics: SkillMutationAnalytics;
}): Promise<AgentSkillListItem | ServiceError> => {
    // Shared skills are only manageable while enabled (mirrors the
    // requireManageableSharedSkill rule); a disabled shared skill resolves to
    // not-found rather than revealing its state.
    const scopeWhere = target.scope === 'personal'
        ? personalAgentSkillAuthScope(userId, orgId)
        : { ...sharedAgentSkillAuthScope(orgId), enabled: true };

    const existingSkill = await prisma.agentSkill.findFirst({
        where: {
            ...(target.id !== undefined ? { id: target.id } : { slug: target.slug }),
            ...scopeWhere,
        },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            instructions: true,
            sourceRepoName: true,
            createdById: true,
        },
    });

    if (!existingSkill) {
        return skillNotFound();
    }

    if (target.scope === 'shared') {
        const isManageable = policy.sharedManageableBy === 'creator'
            ? existingSkill.createdById === userId
            : canManageSharedSkill(existingSkill, userId, role ?? OrgRole.MEMBER);
        if (!isManageable) {
            return insufficientSkillPermissions();
        }
    }

    if (!policy.allowSynced && existingSkill.sourceRepoName !== null) {
        return syncedSkillNotEditable(existingSkill.sourceRepoName);
    }

    const merged = agentSkillInputSchema.safeParse({
        name: fields.name ?? existingSkill.name,
        slug: fields.slug ?? existingSkill.slug,
        description: fields.description ?? existingSkill.description,
        instructions: fields.instructions ?? existingSkill.instructions,
    });

    if (!merged.success) {
        return requestBodySchemaValidationError(merged.error);
    }

    const isSynced = existingSkill.sourceRepoName !== null;
    const changedFieldTypes = getChangedFieldTypes(existingSkill, merged.data);
    const eventBase: SkillEventBase<'ask_skill_updated'> = {
        source: analytics.source,
        entryPoint: analytics.entryPoint,
        scope: target.scope,
        isSynced,
        skillIdHash: hashSkillId(existingSkill.id),
        changedFieldTypes,
    };

    try {
        const skill = await prisma.agentSkill.update({
            where: { id: existingSkill.id },
            data: {
                slug: merged.data.slug,
                name: merged.data.name,
                description: merged.data.description,
                instructions: merged.data.instructions,
                updatedById: userId,
            },
        });

        emitSkillEvent('ask_skill_updated', eventBase, { success: true });
        return toAgentSkillListItem(skill);
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            emitSkillEvent('ask_skill_updated', eventBase, {
                success: false,
                failureReason: ErrorCode.AGENT_SKILL_ALREADY_EXISTS,
            });
            return skillAlreadyExists(merged.data.slug);
        }

        emitSkillEvent('ask_skill_updated', eventBase, {
            success: false,
            failureReason: ErrorCode.UNEXPECTED_ERROR,
        });
        throw error;
    }
};
