'use server';

import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { ServiceError } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { encryptActivationCode, decryptActivationCode } from "@sourcebot/shared";
import { syncWithLighthouse } from "@/ee/features/lighthouse/servicePing";
import { isServiceError } from "@/lib/utils";
import { client } from "./client";

export const activateLicense = async (activationCode: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            // Check if a license already exists
            const existing = await prisma.license.findUnique({
                where: { orgId: org.id },
            });

            if (existing) {
                return {
                    statusCode: StatusCodes.CONFLICT,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: "A license already exists for this organization.",
                } satisfies ServiceError;
            }

            await prisma.license.create({
                data: {
                    orgId: org.id,
                    activationCode: encryptActivationCode(activationCode),
                },
            });

            // Immediately ping Lighthouse to validate and sync license data
            try {
                await syncWithLighthouse(org.id);
            } catch {
                // If the ping fails, remove the license record
                await prisma.license.delete({
                    where: { orgId: org.id },
                });

                return {
                    statusCode: StatusCodes.BAD_GATEWAY,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: "Failed to validate activation code. Please try again.",
                } satisfies ServiceError;
            }

            return { success: true };
        })
    )
);

export const refreshLicense = async (): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const existing = await prisma.license.findUnique({
                where: { orgId: org.id },
            });

            if (!existing) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.NOT_FOUND,
                    message: "No license found.",
                } satisfies ServiceError;
            }

            try {
                await syncWithLighthouse(org.id);
            } catch {
                return {
                    statusCode: StatusCodes.BAD_GATEWAY,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: "Failed to refresh license. Please try again.",
                } satisfies ServiceError;
            }

            return { success: true };
        })
    )
);

export const createCheckoutSession = async (successUrl: string, cancelUrl: string): Promise<{ url: string } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!user.email) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: "User does not have an email address.",
                } satisfies ServiceError;
            }

            const memberCount = await prisma.userToOrg.count({
                where: {
                    orgId: org.id,
                },
            });

            const result = await client.checkout({
                email: user.email,
                quantity: Math.max(memberCount, 1),
                successUrl,
                cancelUrl,
            });

            if (isServiceError(result)) {
                return result;
            }

            return { url: result.url };
        })
    )
);

export const deactivateLicense = async (): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const existing = await prisma.license.findUnique({
                where: { orgId: org.id },
            });

            if (!existing) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.NOT_FOUND,
                    message: "No license found.",
                } satisfies ServiceError;
            }

            await prisma.license.delete({
                where: { orgId: org.id },
            });

            return { success: true };
        })
    )
);

export const createPortalSession = async (returnUrl: string): Promise<{ url: string } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const license = await prisma.license.findUnique({
                where: { orgId: org.id },
            });

            if (!license) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.NOT_FOUND,
                    message: "No license found.",
                } satisfies ServiceError;
            }

            const activationCode = decryptActivationCode(license.activationCode);

            const result = await client.portal({
                activationCode,
                returnUrl,
            });

            if (isServiceError(result)) {
                return result;
            }

            return { url: result.url };
        })
    )
);
