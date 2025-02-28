import 'client-only';

import { getEnv, getEnvBoolean, getEnvNumber } from "./utils";

export const NEXT_PUBLIC_POSTHOG_PAPIK = getEnv(process.env.NEXT_PUBLIC_POSTHOG_PAPIK);
export const NEXT_PUBLIC_POSTHOG_HOST = getEnv(process.env.NEXT_PUBLIC_POSTHOG_HOST);
export const NEXT_PUBLIC_POSTHOG_UI_HOST = getEnv(process.env.NEXT_PUBLIC_POSTHOG_UI_HOST);
export const NEXT_PUBLIC_POSTHOG_ASSET_HOST = getEnv(process.env.NEXT_PUBLIC_POSTHOG_ASSET_HOST);
export const NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED = getEnvBoolean(process.env.NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED, false);
export const NEXT_PUBLIC_SOURCEBOT_VERSION = getEnv(process.env.NEXT_PUBLIC_SOURCEBOT_VERSION, "unknown")!;
export const NEXT_PUBLIC_DOMAIN_SUB_PATH = getEnv(process.env.NEXT_PUBLIC_DOMAIN_SUB_PATH, "")!;
export const NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = getEnv(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
export const NEXT_PUBLIC_POLLING_INTERVAL_MS = getEnvNumber(process.env.NEXT_PUBLIC_POLLING_INTERVAL_MS, 5000);
export const NEXT_PUBLIC_ROOT_DOMAIN = getEnv(process.env.NEXT_PUBLIC_ROOT_DOMAIN, "localhost:3000")!;