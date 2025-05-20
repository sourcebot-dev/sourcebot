"use server";

import { ServiceError } from "@/lib/serviceError";
import { getOrgFromDomain } from "@/data/org";
import { orgMetadataSchema } from "@/types";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";
import { prisma } from "@/prisma";

export async function getPublicAccessStatus(domain: string): Promise<boolean | ServiceError> {
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
}

export async function flipPublicAccessStatus(domain: string): Promise<boolean | ServiceError> {
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

    await prisma.org.update({
        where: {
            id: org.id,
        },
        data: {
            metadata: {
                publicAccessEnabled: !orgMetadata.data.publicAccessEnabled,
            },
        },
    });

    return !orgMetadata.data.publicAccessEnabled;
}