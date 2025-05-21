"use server";

import { ServiceError } from "@/lib/serviceError";
import { getOrgFromDomain } from "@/data/org";
import { orgMetadataSchema } from "@/types";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";
import { prisma } from "@/prisma";
import { sew } from "@/actions";
import { getPlan, hasEntitlement } from "@/features/entitlements/server";
import { SOURCEBOT_GUEST_USER_EMAIL, SOURCEBOT_GUEST_USER_ID, SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants";
import { OrgRole } from "@sourcebot/db";

export const getPublicAccessStatus = async (domain: string): Promise<boolean | ServiceError> => sew(async () => {
    const org = await getOrgFromDomain(domain);
    if (!org) {
        return {
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.NOT_FOUND,
            message: "Organization not found",
        } satisfies ServiceError;
    }

    const orgMetadata = orgMetadataSchema.safeParse(org.metadata);
    if (!orgMetadata.success) {
        return {
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            errorCode: ErrorCode.INVALID_ORG_METADATA,
            message: "Invalid organization metadata",
        } satisfies ServiceError;
    }

    return !!orgMetadata.data.publicAccessEnabled;
});

export const setPublicAccessStatus = async (domain: string, enabled: boolean): Promise<ServiceError | boolean> => sew(async () => {
    const hasPublicAccessEntitlement = hasEntitlement("public-access");
    if (!hasPublicAccessEntitlement) {
        const plan = getPlan();
        console.error(`Public access isn't supported in your current plan: ${plan}. If you have a valid enterprise license key, pass it via SOURCEBOT_EE_LICENSE_KEY. For support, contact ${SOURCEBOT_SUPPORT_EMAIL}.`);
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "Public access is not supported in your current plan",
        } satisfies ServiceError;
    }

    const org = await getOrgFromDomain(domain);
    if (!org) {
        return {
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.NOT_FOUND,
            message: "Organization not found",
        } satisfies ServiceError;
    }

    await prisma.org.update({
        where: {
            id: org.id,
        },
        data: {
            metadata: {
                publicAccessEnabled: enabled,
            },
        },
    });

    return true;
});

export const createGuestUser = async (domain: string) => sew(async () => {
    const hasPublicAccessEntitlement = hasEntitlement("public-access");
    if (!hasPublicAccessEntitlement) {
        console.error(`Public access isn't supported in your current plan: ${getPlan()}. If you have a valid enterprise license key, pass it via SOURCEBOT_EE_LICENSE_KEY. For support, contact ${SOURCEBOT_SUPPORT_EMAIL}.`);
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "Public access is not supported in your current plan",
        } satisfies ServiceError;
    }

    const org = await getOrgFromDomain(domain);
    if (!org) {
        return {
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.NOT_FOUND,
            message: "Organization not found",
        } satisfies ServiceError;
    }

    const user = await prisma.user.upsert({
        where: {
            id: SOURCEBOT_GUEST_USER_ID,
        },
        update: {},
        create: {
            id: SOURCEBOT_GUEST_USER_ID,
            name: "Guest",
            email: SOURCEBOT_GUEST_USER_EMAIL,
            pendingApproval: false,
        },
    });

    await prisma.org.update({
        where: {
            id: org.id,
        },
        data: {
            members: {
                upsert: {
                    where: {
                        orgId_userId: {
                            orgId: org.id,
                            userId: user.id,
                        },
                    },
                    update: {},
                    create: {
                        role: OrgRole.GUEST,
                        user: {
                            connect: { id: user.id },
                        },
                    },
                },
            },
        },
    });
});
