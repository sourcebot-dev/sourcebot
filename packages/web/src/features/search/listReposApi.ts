import { listRepositoriesResponseSchema } from "../../lib/schemas";
import { invalidZoektResponse, ServiceError, unexpectedError } from "../../lib/serviceError";
import { ListRepositoriesResponse } from "../../lib/types";
import { zoektFetch } from "./zoektClient";


export const listRepositories = async (orgId: number): Promise<ListRepositoriesResponse | ServiceError> => {
    const body = JSON.stringify({
        opts: {
            Field: 0,
        }
    });

    let header: Record<string, string> = {};
    header = {
        "X-Tenant-ID": orgId.toString()
    };

    const listResponse = await zoektFetch({
        path: "/api/list",
        body,
        header,
        method: "POST",
        cache: "no-store",
    });

    if (!listResponse.ok) {
        return invalidZoektResponse(listResponse);
    }

    const listBody = await listResponse.json();
    const parsedListResponse = listRepositoriesResponseSchema.safeParse(listBody);
    if (!parsedListResponse.success) {
        console.error(`Failed to parse zoekt response. Error: ${parsedListResponse.error}`);
        return unexpectedError(`Something went wrong while parsing the response from zoekt`);
    }

    return parsedListResponse.data;
}