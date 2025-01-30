'use server';

import { listRepositories } from "@/lib/server/searchService";
import { getCurrentUserOrg } from "../../../../auth";
import { isServiceError } from "@/lib/utils";
import { serviceErrorResponse } from "@/lib/serviceError";

export const GET = async () => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return serviceErrorResponse(orgId);
    }

    const response = await listRepositories(orgId);
    return Response.json(response);
}