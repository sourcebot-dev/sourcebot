import { getFolderContents, getFolderContentsRequestSchema } from "@/features/git";
import { apiHandler } from "@/lib/apiHandler";
import { queryParamsSchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to getFolderContents() which calls withOptionalAuth
export const GET = apiHandler(async (request: NextRequest): Promise<Response> => {
    const rawParams = Object.fromEntries(
        Object.keys(getFolderContentsRequestSchema.shape).map(key => [
            key,
            request.nextUrl.searchParams.get(key) ?? undefined
        ])
    );
    const parsed = getFolderContentsRequestSchema.safeParse(rawParams);

    if (!parsed.success) {
        return serviceErrorResponse(
            queryParamsSchemaValidationError(parsed.error)
        );
    }

    const result = await getFolderContents(parsed.data);

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
