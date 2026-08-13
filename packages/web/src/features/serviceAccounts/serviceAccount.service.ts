import 'server-only';

import { createAudit } from "@/ee/features/audit/audit";
import { type AuditActor } from "@/ee/features/audit/types";
import {
    removeMember,
    setMemberRole,
    setMembershipSuspended,
} from "@/features/membership/membership.service";
import { ErrorCode } from "@/lib/errorCodes";
import { type ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { __unsafePrisma as prisma } from "@/prisma";
import { ApiKey, OrgRole, User, UserToOrg, UserType, UserWithAccounts } from "@sourcebot/db";
import { generateApiKey } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";
import { randomUUID } from "crypto";
import { serviceAccountNotFoundError } from "./errors";

export interface CreateServiceAccountOptions {
    actor: AuditActor;
    name: string;
    description?: string;
    role: OrgRole;
}

/**
 * Creates a service account: a `User` (`type: SERVICE`) with an immediately
 * active `UserToOrg` membership (no pending-invite flow, and no seat-cap
 * check — service accounts don't consume seats, see `humanMembershipWhere`).
 * Its repo visibility is governed purely by `role`, exactly like a human
 * member.
 */
export const createServiceAccount = async (
    orgId: number,
    options: CreateServiceAccountOptions,
): Promise<UserWithAccounts | ServiceError> => {
    const { actor, name, description, role } = options;

    const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
            data: {
                // Never user-facing or treated as a login identifier -- just
                // satisfies the `email` unique constraint shared with human
                // users.
                email: `svc+${randomUUID()}@service.internal`,
                name,
                description,
                type: UserType.SERVICE,
                createdById: actor.type === "user" ? actor.id : null,
            },
            include: { accounts: true },
        });

        await tx.userToOrg.create({
            data: {
                orgId,
                userId: created.id,
                role,
                lastActiveAt: new Date(),
            },
        });

        return created;
    });

    await createAudit({
        action: "service_account.created",
        actor,
        target: { id: user.id, type: "service_account" },
        orgId,
        metadata: { message: `Created service account "${name}"` },
    });

    return user;
};

export interface UpdateServiceAccountOptions {
    actor: AuditActor;
    name?: string;
    description?: string;
}

export const updateServiceAccount = async (
    orgId: number,
    serviceAccountId: string,
    options: UpdateServiceAccountOptions,
): Promise<UserWithAccounts | ServiceError> => {
    const { actor, name, description } = options;

    const target = await getServiceAccount(orgId, serviceAccountId);
    if (isServiceError(target)) {
        return target;
    }

    const user = await prisma.user.update({
        where: { id: serviceAccountId },
        data: {
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description } : {}),
        },
        include: { accounts: true },
    });

    await createAudit({
        action: "service_account.updated",
        actor,
        target: { id: user.id, type: "service_account" },
        orgId,
    });

    return user;
};

export const setServiceAccountRole = async (
    orgId: number,
    serviceAccountId: string,
    role: OrgRole,
    options: { actor: AuditActor },
): Promise<ServiceError | null> => {
    const target = await getServiceAccount(orgId, serviceAccountId);
    if (isServiceError(target)) {
        return target;
    }

    return setMemberRole(orgId, serviceAccountId, role, {
        actor: options.actor,
        targetType: "service_account",
    });
};

/**
 * Suspending a service account revokes all of its API keys and OAuth
 * credentials immediately (via `setMembershipSuspended` ->
 * `revokeAllUserAuthCredentials`) — the equivalent of "suspend = revoke
 * everything it can authenticate with".
 */
export const suspendServiceAccount = async (
    orgId: number,
    serviceAccountId: string,
    options: { actor: AuditActor },
): Promise<ServiceError | UserToOrg> => {
    const target = await getServiceAccount(orgId, serviceAccountId);
    if (isServiceError(target)) {
        return target;
    }

    return setMembershipSuspended(orgId, serviceAccountId, true, {
        actor: options.actor,
        targetType: "service_account",
    });
};

export const reactivateServiceAccount = async (
    orgId: number,
    serviceAccountId: string,
    options: { actor: AuditActor },
): Promise<ServiceError | UserToOrg> => {
    const target = await getServiceAccount(orgId, serviceAccountId);
    if (isServiceError(target)) {
        return target;
    }

    return setMembershipSuspended(orgId, serviceAccountId, false, {
        actor: options.actor,
        targetType: "service_account",
    });
};

/**
 * Hard-deletes the service account's `User` row (unlike human member removal,
 * which preserves the `User` and only deletes the `UserToOrg` row). Cascades
 * to its `UserToOrg` membership and `ApiKey`s via `onDelete: Cascade`.
 */
export const removeServiceAccount = async (
    orgId: number,
    serviceAccountId: string,
    options: { actor: AuditActor },
): Promise<ServiceError | null> => {
    const target = await getServiceAccount(orgId, serviceAccountId);
    if (isServiceError(target)) {
        return target;
    }

    // Reuses removeMember's last-owner protection and membership deletion,
    // then hard-deletes the now-membership-less User row.
    const result = await removeMember(orgId, serviceAccountId, {
        actor: options.actor,
        targetType: "service_account",
    });
    if (isServiceError(result)) {
        return result;
    }

    await prisma.user.delete({ where: { id: serviceAccountId } });

    await createAudit({
        action: "service_account.removed",
        actor: options.actor,
        target: { id: serviceAccountId, type: "service_account" },
        orgId,
    });

    return null;
};

export interface ServiceAccountSummary {
    id: string;
    name: string | null;
    description: string | null;
    role: OrgRole;
    createdById: string | null;
    joinedAt: Date;
    suspendedAt: Date | null;
    lastActiveAt: Date | null;
}

export const listServiceAccounts = async (orgId: number): Promise<ServiceAccountSummary[]> => {
    const memberships = await prisma.userToOrg.findMany({
        where: {
            orgId,
            user: { type: UserType.SERVICE },
        },
        include: { user: true },
        orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((membership) => ({
        id: membership.userId,
        name: membership.user.name,
        description: membership.user.description,
        role: membership.role,
        createdById: membership.user.createdById,
        joinedAt: membership.joinedAt,
        suspendedAt: membership.suspendedAt,
        lastActiveAt: membership.lastActiveAt,
    }));
};

/**
 * Resolves `serviceAccountId` to a `User`, verifying it belongs to `orgId`
 * and is a service account (never a human). Every mutation above guards with
 * this so that, e.g., a human member's id can never be passed into
 * `removeServiceAccount`.
 */
const getServiceAccount = async (orgId: number, serviceAccountId: string): Promise<User | ServiceError> => {
    const membership = await prisma.userToOrg.findUnique({
        where: { orgId_userId: { orgId, userId: serviceAccountId } },
        include: { user: true },
    });

    if (!membership || membership.user.type !== UserType.SERVICE) {
        return serviceAccountNotFoundError();
    }

    return membership.user;
};

export interface CreateServiceAccountApiKeyOptions {
    actor: AuditActor;
}

export const createServiceAccountApiKey = async (
    orgId: number,
    serviceAccountId: string,
    name: string,
    options: CreateServiceAccountApiKeyOptions,
): Promise<{ key: string } | ServiceError> => {
    const target = await getServiceAccount(orgId, serviceAccountId);
    if (isServiceError(target)) {
        return target;
    }

    const existingApiKey = await prisma.apiKey.findFirst({
        where: { createdById: serviceAccountId, name },
    });
    if (existingApiKey) {
        await createAudit({
            action: "api_key.creation_failed",
            actor: options.actor,
            target: { id: serviceAccountId, type: "service_account" },
            orgId,
            metadata: { message: `API key ${name} already exists`, api_key: name },
        });
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.API_KEY_ALREADY_EXISTS,
            message: `API key ${name} already exists`,
        } satisfies ServiceError;
    }

    const { key, hash } = generateApiKey();
    const apiKey = await prisma.apiKey.create({
        data: { name, hash, orgId, createdById: serviceAccountId },
    });

    await createAudit({
        action: "api_key.created",
        actor: options.actor,
        target: { id: apiKey.hash, type: "api_key" },
        orgId,
        metadata: { message: `Created for service account ${serviceAccountId}`, api_key: name },
    });

    return { key };
};

export const deleteServiceAccountApiKey = async (
    orgId: number,
    serviceAccountId: string,
    name: string,
    options: { actor: AuditActor },
): Promise<{ success: boolean } | ServiceError> => {
    const target = await getServiceAccount(orgId, serviceAccountId);
    if (isServiceError(target)) {
        return target;
    }

    const apiKey = await prisma.apiKey.findFirst({
        where: { name, createdById: serviceAccountId },
    });
    if (!apiKey) {
        await createAudit({
            action: "api_key.deletion_failed",
            actor: options.actor,
            target: { id: serviceAccountId, type: "service_account" },
            orgId,
            metadata: { message: `API key ${name} not found`, api_key: name },
        });
        return {
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.API_KEY_NOT_FOUND,
            message: `API key ${name} not found for this service account`,
        } satisfies ServiceError;
    }

    await prisma.apiKey.delete({ where: { hash: apiKey.hash } });

    await createAudit({
        action: "api_key.deleted",
        actor: options.actor,
        target: { id: apiKey.hash, type: "api_key" },
        orgId,
        metadata: { message: `Deleted for service account ${serviceAccountId}`, api_key: name },
    });

    return { success: true };
};

export const getServiceAccountApiKeys = async (
    orgId: number,
    serviceAccountId: string,
): Promise<Pick<ApiKey, 'name' | 'createdAt' | 'lastUsedAt'>[] | ServiceError> => {
    const target = await getServiceAccount(orgId, serviceAccountId);
    if (isServiceError(target)) {
        return target;
    }

    const apiKeys = await prisma.apiKey.findMany({
        where: { orgId, createdById: serviceAccountId },
        orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((key) => ({
        name: key.name,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
    }));
};
