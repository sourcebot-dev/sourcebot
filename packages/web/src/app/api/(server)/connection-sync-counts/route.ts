import { getConnectionSyncCounts } from "@/features/connections/connectionSyncCounts.server";
import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { sew } from "@/middleware/sew";
import { OrgRole } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";

export const GET = apiHandler(async () => {
    const result = await sew(() =>
        withAuth(({ org, role }) =>
            withMinimumOrgRole(role, OrgRole.OWNER, () =>
                getConnectionSyncCounts(org.id)
            )
        )
    );

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});
