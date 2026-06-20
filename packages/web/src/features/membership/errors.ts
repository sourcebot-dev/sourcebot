import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";


export const seatLimitReached = (): ServiceError => ({
    statusCode: StatusCodes.BAD_REQUEST,
    errorCode: ErrorCode.ORG_SEAT_COUNT_REACHED,
    message: "Organization is at max capacity",
});

export const lastOwnerError = (reason: "removed" | "left"): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED,
    message: reason === "left"
        ? "You are the last owner of this organization. Promote another member to owner before leaving."
        : "Cannot remove the last owner of the organization",
});

export const lastOwnerDemoteError = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.LAST_OWNER_CANNOT_BE_DEMOTED,
    message: "Cannot demote the last owner. Promote another member to owner first.",
});

// When SCIM is enabled the IdP is the source of truth for membership, so paths
// that would grant membership outside it (invites, join requests) are disabled.
export const membershipManagedByIdpError = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.MEMBERSHIP_MANAGED_BY_IDP,
    message: "SCIM provisioning is enabled. Membership is managed through your identity provider.",
});