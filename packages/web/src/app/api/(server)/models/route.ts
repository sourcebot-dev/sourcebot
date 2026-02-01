import { sew } from "@/actions";
import { apiHandler } from "@/lib/apiHandler";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/actions";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuthV2 } from "@/withAuthV2";

export const GET = apiHandler(async () => {
    const response = await sew(() =>
        withOptionalAuthV2(async () => {
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
