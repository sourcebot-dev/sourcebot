'use server';

import { auditActorForUser } from "@/ee/features/audit/utils";
import {
    createServiceAccount,
    createServiceAccountApiKey,
    deleteServiceAccountApiKey,
    getServiceAccountApiKeys,
    listServiceAccounts as listServiceAccountsService,
    reactivateServiceAccount,
    removeServiceAccount,
    ServiceAccountSummary,
    setServiceAccountRole,
    suspendServiceAccount,
    updateServiceAccount,
} from "@/features/serviceAccounts/serviceAccount.service";
import { ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";

// Service accounts are managed strictly by org OWNERs, unconditionally --
// unlike a human's own API keys, this isn't gated by
// DISABLE_API_KEY_CREATION_FOR_NON_OWNER_USERS/DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS,
// since those flags govern a human's *own* keys, not org-wide credential
// management.
export const listServiceAccounts = async (): Promise<ServiceAccountSummary[] | ServiceError> => sew(() =>
    withAuth(async ({ org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            return listServiceAccountsService(org.id);
        })));

export const createServiceAccountAction = async (input: { name: string; description?: string; role: OrgRole }): Promise<ServiceAccountSummary | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const result = await createServiceAccount(org.id, {
                actor: auditActorForUser(user),
                ...input,
            });

            if (isServiceError(result)) {
                return result;
            }

            return {
                id: result.id,
                name: result.name,
                description: result.description,
                role: input.role,
                createdById: result.createdById,
                joinedAt: new Date(),
                suspendedAt: null,
                lastActiveAt: new Date(),
            } satisfies ServiceAccountSummary;
        })));

export const renameServiceAccountAction = async (serviceAccountId: string, input: { name?: string; description?: string }): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const result = await updateServiceAccount(org.id, serviceAccountId, {
                actor: auditActorForUser(user),
                ...input,
            });

            if (isServiceError(result)) {
                return result;
            }

            return { success: true };
        })));

export const setServiceAccountRoleAction = async (serviceAccountId: string, role: OrgRole): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role: callerRole }) =>
        withMinimumOrgRole(callerRole, OrgRole.OWNER, async () => {
            const result = await setServiceAccountRole(org.id, serviceAccountId, role, {
                actor: auditActorForUser(user),
            });

            if (isServiceError(result)) {
                return result;
            }

            return { success: true };
        })));

export const suspendServiceAccountAction = async (serviceAccountId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const result = await suspendServiceAccount(org.id, serviceAccountId, {
                actor: auditActorForUser(user),
            });

            if (isServiceError(result)) {
                return result;
            }

            return { success: true };
        })));

export const reactivateServiceAccountAction = async (serviceAccountId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const result = await reactivateServiceAccount(org.id, serviceAccountId, {
                actor: auditActorForUser(user),
            });

            if (isServiceError(result)) {
                return result;
            }

            return { success: true };
        })));

export const removeServiceAccountAction = async (serviceAccountId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const result = await removeServiceAccount(org.id, serviceAccountId, {
                actor: auditActorForUser(user),
            });

            if (isServiceError(result)) {
                return result;
            }

            return { success: true };
        })));

export const createServiceAccountApiKeyAction = async (serviceAccountId: string, name: string): Promise<{ key: string } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            return createServiceAccountApiKey(org.id, serviceAccountId, name, {
                actor: auditActorForUser(user),
            });
        })));

export const deleteServiceAccountApiKeyAction = async (serviceAccountId: string, name: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            return deleteServiceAccountApiKey(org.id, serviceAccountId, name, {
                actor: auditActorForUser(user),
            });
        })));

export const getServiceAccountApiKeysAction = async (serviceAccountId: string) => sew(() =>
    withAuth(async ({ org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            return getServiceAccountApiKeys(org.id, serviceAccountId);
        })));
