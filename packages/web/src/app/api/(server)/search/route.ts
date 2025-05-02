'use server';

import { search } from "@/features/search/searchApi";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";
import { sew, withAuth, withOrgMembership } from "@/actions";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { searchRequestSchema } from "@/features/search/schemas";
import { SearchRequest } from "@/features/search/types";

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const parsed = await searchRequestSchema.safeParseAsync(body);
    if (!parsed.success) {
        return serviceErrorResponse(
            schemaValidationError(parsed.error)
        );
    }

    const response = await postSearch(parsed.data);
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }
    return Response.json(response);
}

// @nocheckin: need to handle auth
// const postSearch = (request: SearchRequest, domain: string) => sew(() =>
//     withAuth((session) =>
//         withOrgMembership(session, domain, async ({ orgId }) => {
//             const response = await search(request, orgId);
//             return response;
//         }
//     ), /* allowSingleTenantUnauthedAccess */ true));

const postSearch = (request: SearchRequest) => sew(async () => {
    const response = await search(request, 1);
    return response;
});

