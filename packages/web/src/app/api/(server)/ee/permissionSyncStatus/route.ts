import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { StatusCodes } from "http-status-codes";
import { getPermissionSyncStatus } from "./api";

/**
 * Returns whether a user has a account that has it's permissions
 * synced for the first time.
 */
export const GET = apiHandler(async () => {
    const result = await getPermissionSyncStatus();

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});