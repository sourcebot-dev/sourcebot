import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { getRepositorySyncCounts } from "@/features/repos/repositorySyncCounts.server";
import { StatusCodes } from "http-status-codes";

// eslint-disable-next-line authz/require-auth-wrapper -- Authentication and owner authorization are enforced by getRepositorySyncCounts.
export const GET = apiHandler(async () => {
    const result = await sew(() => getRepositorySyncCounts());

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});
