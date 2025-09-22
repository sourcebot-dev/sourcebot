import { StatusCodes } from "http-status-codes";
import { OrgRole } from "@sourcebot/db";
import { ErrorCode } from "./lib/errorCodes";
import { ServiceError } from "./lib/serviceError";

export const withMinimumOrgRole = async <T>(
    userRole: OrgRole,
    minRequiredRole: OrgRole = OrgRole.MEMBER,
    fn: () => Promise<T>,
) => {

    const getAuthorizationPrecedence = (role: OrgRole): number => {
        switch (role) {
            case OrgRole.GUEST:
                return 0;
            case OrgRole.MEMBER:
                return 1;
            case OrgRole.OWNER:
                return 2;
        }
    };

    if (
        getAuthorizationPrecedence(userRole) < getAuthorizationPrecedence(minRequiredRole)
    ) {
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to perform this action.",
        } satisfies ServiceError;
    }

    return fn();
}
