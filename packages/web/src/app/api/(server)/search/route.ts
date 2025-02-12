'use server';

import { search } from "@/lib/server/searchService";
import { searchRequestSchema } from "@/lib/schemas";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { withAuth, withOrgMembership } from "@/actions";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { SearchRequest } from "@/lib/types";

export const POST = async (request: NextRequest) => {
    const domain = request.headers.get("X-Org-Domain")!;
    const body = await request.json();
    const parsed = await searchRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }
    
    const response = await postSearch(parsed.data, domain);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }
    return Response.json(response);
}

const postSearch = (request: SearchRequest, domain: string) =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            const response = await search(request, orgId);
            return response;
        }))