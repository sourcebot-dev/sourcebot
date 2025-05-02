'use server';

import { fileSourceRequestSchema } from "@/lib/schemas";
import { getFileSource } from "@/features/search/fileSourceApi";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { sew, withAuth, withOrgMembership } from "@/actions";
import { FileSourceRequest } from "@/lib/types";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await fileSourceRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }


    const response = await postSource(parsed.data, request.headers.get("X-Org-Domain")!);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
}


const postSource = (request: FileSourceRequest, domain: string) => sew(() =>
    withAuth(async (session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const response = await getFileSource(request, orgId);
            return response;
        }
    ), /* allowSingleTenantUnauthedAccess */ true));
