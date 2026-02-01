'use server';

import { fetchAuditRecords } from "@/ee/features/audit/actions";
import { apiHandler } from "@/lib/apiHandler";
import { ErrorCode } from "@/lib/errorCodes";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { getEntitlements } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";

export const GET = apiHandler(async () => {
    const entitlements = getEntitlements();
    if (!entitlements.includes('audit')) {
        return serviceErrorResponse({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.NOT_FOUND,
            message: "Audit logging is not enabled for your license",
        });
    }

    const result = await fetchAuditRecords();
    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }
    return Response.json(result);
}); 