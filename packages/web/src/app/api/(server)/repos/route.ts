'use server';

import { listRepositories } from "@/lib/server/searchService";
import { getCurrentUserOrg } from "../../../../auth";
import { isServiceError } from "@/lib/utils";

export const GET = async () => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
    }

    const response = await listRepositories(orgId);
    return Response.json(response);
}