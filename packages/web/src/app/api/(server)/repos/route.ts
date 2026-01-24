import { getRepos } from "@/actions";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { GetReposResponse } from "@/lib/types";

export const GET = async () => {
    const response: GetReposResponse = await getRepos();
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }
    return Response.json(response);
}
