import { notAuthenticated, type ServiceError } from "@/lib/serviceError";
import { env } from "@sourcebot/shared";

/**
 * Public SaaS requires an authenticated user for Ask requests. Self-hosted
 * deployments retain their existing anonymous-access behavior.
 */
export const checkAskAuthentication = (user: object | undefined): ServiceError | null => {
    if (env.EXPERIMENT_ASK_GH_ENABLED === "true" && !user) {
        return notAuthenticated();
    }

    return null;
};
