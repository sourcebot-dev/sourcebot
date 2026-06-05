import { listChangelogEntries } from "@/features/changelog/listEntriesApi";
import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";

// eslint-disable-next-line authz/require-auth-wrapper -- delegates to listChangelogEntries() which calls withOptionalAuth
export const GET = apiHandler(async () => {
    const response = await listChangelogEntries();

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return Response.json(response);
});
