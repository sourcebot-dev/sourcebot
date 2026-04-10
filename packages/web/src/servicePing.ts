import { fetchWithRetry } from "@/lib/utils";
import { createLogger, env, SOURCEBOT_VERSION } from "@sourcebot/shared";

const logger = createLogger('service-ping');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const sendPing = async () => {
    const payload = {
        installId: env.SOURCEBOT_INSTALL_ID,
        version: SOURCEBOT_VERSION,
    };

    try {
        const response = await fetchWithRetry(`${env.SOURCEBOT_LIGHTHOUSE_URL}/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            logger.error(`Service ping failed with status ${response.status}`);
        } else {
            logger.info(`Service ping sent successfully`);
        }
    } catch (error) {
        logger.error(`Service ping failed: ${error}`);
    }
};

export const startServicePing = () => {
    // Fire immediately on startup
    sendPing();

    // Then repeat daily
    setInterval(sendPing, ONE_DAY_MS);
};
