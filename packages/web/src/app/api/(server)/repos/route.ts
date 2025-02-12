'use server';

import { listRepositories } from "@/lib/server/searchService";
import { NextRequest } from "next/server";
import { withAuth, withOrgMembership } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { serviceErrorResponse } from "@/lib/serviceError";

export const GET = async (request: NextRequest) => {
    const domain = request.headers.get("X-Org-Domain")!;
    const response = await getRepos(domain);

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }
    return Response.json(response);
}


const getRepos = (domain: string) =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            const response = await listRepositories(orgId);
            return response;
        })
    );