import { getRepoInfo } from "@/app/[domain]/askgh/[owner]/[repo]/api";
import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

export const GET = apiHandler(async (
    _request: NextRequest,
    { params }: { params: Promise<{ repoId: string }> }
) => {
    const { repoId } = await params;
    const repoIdNum = parseInt(repoId);

    if (isNaN(repoIdNum)) {
        return new Response("Invalid repo ID", { status: 400 });
    }

    const result = await getRepoInfo(repoIdNum);

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
});
