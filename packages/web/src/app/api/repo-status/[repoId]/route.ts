import { getRepoInfo } from "@/app/[domain]/askgh/[owner]/[repo]/api";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

export async function GET(
    _request: NextRequest,
    props: { params: Promise<{ repoId: string }> }
) {
    const params = await props.params;
    const { repoId } = params;
    const repoIdNum = parseInt(repoId);

    if (isNaN(repoIdNum)) {
        return new Response("Invalid repo ID", { status: 400 });
    }

    const result = await getRepoInfo(repoIdNum);

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
}
