import 'client-only';

import { getEnv, getEnvBoolean } from "./utils";

export const NEXT_PUBLIC_POSTHOG_PAPIK = getEnv(process.env.NEXT_PUBLIC_POSTHOG_PAPIK);
export const NEXT_PUBLIC_POSTHOG_HOST = getEnv(process.env.NEXT_PUBLIC_POSTHOG_HOST);
export const NEXT_PUBLIC_POSTHOG_UI_HOST = getEnv(process.env.NEXT_PUBLIC_POSTHOG_UI_HOST);
export const NEXT_PUBLIC_POSTHOG_ASSET_HOST = getEnv(process.env.NEXT_PUBLIC_POSTHOG_ASSET_HOST);
export const NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED = getEnvBoolean(process.env.NEXT_PUBLIC_SOURCEBOT_TELEMETRY_DISABLED, false);
export const NEXT_PUBLIC_SOURCEBOT_VERSION = getEnv(process.env.NEXT_PUBLIC_SOURCEBOT_VERSION, "unknown")!;
export const NEXT_PUBLIC_DOMAIN_SUB_PATH = getEnv(process.env.NEXT_PUBLIC_DOMAIN_SUB_PATH, "")!;
