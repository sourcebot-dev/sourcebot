import { client as lighthouseClient } from "@/ee/features/lighthouse/client";
import { apiHandler } from "@/lib/apiHandler";
import { env } from "@sourcebot/shared";

// eslint-disable-next-line authz/require-auth-wrapper -- this endpoint is intended to not require auth.
export const GET = apiHandler(async () => {
    const offers = await lighthouseClient.offers({
        installId: env.SOURCEBOT_INSTALL_ID,
    });

    return new Response(JSON.stringify(offers), {
        headers: {
            'Cache-Control': 'public, max-age=300'
        }
    });
})