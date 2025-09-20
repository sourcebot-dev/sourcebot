import { getRepoImage } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { NextRequest } from "next/server";

export async function GET(
    _request: NextRequest,
    props: { params: Promise<{ domain: string; repoId: string }> }
) {
    const params = await props.params;
    const { repoId } = params;
    const repoIdNum = parseInt(repoId);

    if (isNaN(repoIdNum)) {
        return new Response("Invalid repo ID", { status: 400 });
    }

    const result = await getRepoImage(repoIdNum);
    if (isServiceError(result)) {
        return new Response(result.message, { status: result.statusCode });
    }

    return new Response(result, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600',
        },
    });
} 