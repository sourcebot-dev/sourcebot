'use server';

import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { ServiceError } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { env, encryptActivationCode } from "@sourcebot/shared";
import { sendServicePing } from "@/ee/features/lighthouse/servicePing";
import { fetchWithRetry } from "@/lib/utils";
import { checkoutResponseSchema } from "./types";

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
                await sendServicePing();
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

export const createCheckoutSession = async (successUrl: string, cancelUrl: string): Promise<{ url: string } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const memberCount = await prisma.userToOrg.count({
                where: {
                    orgId: org.id,
                    role: { not: "GUEST" },
                },
            });

            const response = await fetchWithRetry(`${env.SOURCEBOT_LIGHTHOUSE_URL}/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    quantity: Math.max(memberCount, 1),
                    successUrl,
                    cancelUrl,
                }),
            });

            if (!response.ok) {
                return {
                    statusCode: StatusCodes.BAD_GATEWAY,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: "Failed to create checkout session.",
                } satisfies ServiceError;
            }

            const body = await response.json();
            const result = checkoutResponseSchema.safeParse(body);

            if (!result.success) {
                return {
                    statusCode: StatusCodes.BAD_GATEWAY,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: "Invalid response from Lighthouse.",
                } satisfies ServiceError;
            }

            return { url: result.data.url };
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
