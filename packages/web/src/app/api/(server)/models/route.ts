import { sew } from "@/middleware/sew";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";
import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuth } from "@/middleware/withAuth";

export const GET = apiHandler(async () => {
    const response = await sew(() =>
        withOptionalAuth(async () => {
            const models = await getConfiguredLanguageModelsInfo();
            return models;
        })
    );

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
});
