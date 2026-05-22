import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { getPricing } from "@/ee/features/lighthouse/actions";
import { StatusCodes } from "http-status-codes";

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to getPricing() which calls withAuth
export const GET = apiHandler(async () => {
    const result = await getPricing();

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});
