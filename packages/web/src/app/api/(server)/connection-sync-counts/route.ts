import { getConnectionSyncCounts } from "@/features/connections/connectionSyncCounts.server";
import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { StatusCodes } from "http-status-codes";

// eslint-disable-next-line authz/require-auth-wrapper -- Authentication and owner authorization are enforced by getConnectionSyncCounts.
export const GET = apiHandler(async () => {
    const result = await sew(() => getConnectionSyncCounts());

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});
