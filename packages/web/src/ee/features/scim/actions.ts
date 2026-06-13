'use server';

import { createAudit } from "@/ee/features/audit/audit";
import { ErrorCode } from "@/lib/errorCodes";
import { hasEntitlement } from "@/lib/entitlements";
import { ServiceError } from "@/lib/serviceError";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { env, generateScimToken as generateScimTokenSecret } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";

const scimNotAvailable = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message: "SCIM provisioning is not available in your current plan",
});

/**
 * The base URL an IdP (Okta, Entra) is configured to send SCIM requests to.
 * Exposed at the clean `/scim/v2` path via a rewrite in `next.config.mjs`.
 */
export const getScimBaseUrl = async (): Promise<{ baseUrl: string } | ServiceError> => sew(() =>
    withAuth(async ({ role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!await hasEntitlement('scim')) {
                return scimNotAvailable();
            }
            return { baseUrl: `${env.AUTH_URL.replace(/\/$/, '')}/scim/v2` };
        })));

export const generateScimToken = async (name: string): Promise<{ token: string } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!await hasEntitlement('scim')) {
                return scimNotAvailable();
            }

            const existing = await prisma.scimToken.findFirst({
                where: {
                    orgId: org.id,
                    name,
                },
            });

            if (existing) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.API_KEY_ALREADY_EXISTS,
                    message: `A SCIM token named "${name}" already exists`,
                } satisfies ServiceError;
            }

            const { token, hash } = generateScimTokenSecret();
            const scimToken = await prisma.scimToken.create({
                data: {
                    name,
                    hash,
                    orgId: org.id,
                },
            });

            await createAudit({
                action: "scim_token.created",
                actor: { id: user.id, type: "user" },
                target: { id: scimToken.hash, type: "scim_token" },
                orgId: org.id,
                metadata: { scim_token: name },
            });

            return { token };
        })));

export const revokeScimToken = async (name: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!await hasEntitlement('scim')) {
                return scimNotAvailable();
            }

            const scimToken = await prisma.scimToken.findFirst({
                where: {
                    orgId: org.id,
                    name,
                },
            });

            if (!scimToken) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.API_KEY_NOT_FOUND,
                    message: `SCIM token "${name}" not found`,
                } satisfies ServiceError;
            }

            await prisma.scimToken.delete({
                where: { hash: scimToken.hash },
            });

            await createAudit({
                action: "scim_token.deleted",
                actor: { id: user.id, type: "user" },
                target: { id: scimToken.hash, type: "scim_token" },
                orgId: org.id,
                metadata: { scim_token: name },
            });

            return { success: true };
        })));

export const getScimTokens = async (): Promise<{ name: string; createdAt: Date; lastUsedAt: Date | null }[] | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!await hasEntitlement('scim')) {
                return scimNotAvailable();
            }

            const tokens = await prisma.scimToken.findMany({
                where: { orgId: org.id },
                orderBy: { createdAt: 'desc' },
            });

            return tokens.map((token) => ({
                name: token.name,
                createdAt: token.createdAt,
                lastUsedAt: token.lastUsedAt,
            }));
        })));
