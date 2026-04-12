import { fetchWithRetry } from "@/lib/utils";
import { __unsafePrisma } from "@/prisma";
import { createLogger, env, SOURCEBOT_VERSION } from "@sourcebot/shared";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { lighthouseResponseSchema } from "./types";

const logger = createLogger('service-ping');

const SERVICE_PING_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

export const sendServicePing = async () => {
    // Look up the activation code from the License record
    const license = await __unsafePrisma.license.findUnique({
        where: { orgId: SINGLE_TENANT_ORG_ID },
    });

    const payload = {
        installId: env.SOURCEBOT_INSTALL_ID,
        version: SOURCEBOT_VERSION,
        ...(license?.activationCode && { activationCode: license.activationCode }),
    };

    try {
        const response = await fetchWithRetry(`${env.SOURCEBOT_LIGHTHOUSE_URL}/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            logger.error(`Service ping failed with status ${response.status}`);
            return;
        }

        logger.info(`Service ping sent successfully`);

        // If we have a license, update it with the Lighthouse response
        if (license) {
            const body = await response.json();
            const result = lighthouseResponseSchema.safeParse(body);

            if (!result.success) {
                logger.error(`Invalid Lighthouse response: ${result.error}`);
                return;
            }

            const { plan, seats, status } = result.data;

            await __unsafePrisma.license.update({
                where: { orgId: SINGLE_TENANT_ORG_ID },
                data: {
                    plan,
                    seats,
                    status,
                    lastSyncAt: new Date(),
                },
            });

            logger.info(`License synced: plan=${plan}, seats=${seats}, status=${status}`);
        }
    } catch (error) {
        logger.error(`Service ping failed: ${error}`);
    }
};

export const startServicePingCronJob = () => {
    sendServicePing();
    setInterval(sendServicePing, SERVICE_PING_INTERVAL_MS);
};
