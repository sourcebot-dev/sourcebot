import { getRepos } from "@/actions";
import { repositoryQuerySchema } from "@/lib/schemas";
import { serviceErrorResponse, serviceErrorSchema } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { z } from "zod";

export const responseSchema = z.union([repositoryQuerySchema.array(), serviceErrorSchema]);
export type ResponseType = z.infer<typeof responseSchema>;

export const GET = async () => {
    const response: ResponseType = await getRepos();
    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }
    return Response.json(response);
}
