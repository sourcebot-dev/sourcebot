import { env } from "@sourcebot/shared";

/**
 * Public SaaS requires an authenticated user for Ask requests. Self-hosted
 * deployments retain their existing anonymous-access behavior.
 */
export const isAuthRequiredOverrideEnabled = env.EXPERIMENT_ASK_GH_ENABLED === "true";
