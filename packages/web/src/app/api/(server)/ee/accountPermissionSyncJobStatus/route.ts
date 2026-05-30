import { apiHandler } from "@/lib/apiHandler";
import { queryParamsSchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { getAccountSyncStatus } from "./api";

const queryParamsSchema = z.object({
    jobId: z.string(),
});

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to getAccountSyncStatus() which calls withAuth
export const GET = apiHandler(async (request: NextRequest) => {
    const rawParams = {
        jobId: request.nextUrl.searchParams.get('jobId') ?? undefined,
    };
    const parsed = queryParamsSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const result = await getAccountSyncStatus(parsed.data.jobId);

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});
