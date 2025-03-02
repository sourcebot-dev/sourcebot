import dotenv from 'dotenv';
import * as Sentry from "@sentry/node";

export const getEnv = (env: string | undefined, defaultValue?: string, required?: boolean) => {
	if (required && !env && !defaultValue) {
		const e = new Error(`Missing required environment variable: ${env}`);
		Sentry.captureException(e);
		throw e;
	}

	return env ?? defaultValue;
}

export const getEnvBoolean = (env: string | undefined, defaultValue: boolean) => {
	if (!env) {
		return defaultValue;
	}
	return env === 'true' || env === '1';
}

dotenv.config({
	path: './.env',
});
dotenv.config({
	path: './.env.local',
	override: true
});


export const SOURCEBOT_LOG_LEVEL = getEnv(process.env.SOURCEBOT_LOG_LEVEL, 'info')!;
export const SOURCEBOT_TELEMETRY_DISABLED = getEnvBoolean(process.env.SOURCEBOT_TELEMETRY_DISABLED, false)!;
export const SOURCEBOT_INSTALL_ID = getEnv(process.env.SOURCEBOT_INSTALL_ID, 'unknown')!;
export const SOURCEBOT_VERSION = getEnv(process.env.SOURCEBOT_VERSION, 'unknown')!;
export const POSTHOG_PAPIK = getEnv(process.env.POSTHOG_PAPIK);
export const POSTHOG_HOST = getEnv(process.env.POSTHOG_HOST);

export const FALLBACK_GITHUB_TOKEN = getEnv(process.env.FALLBACK_GITHUB_TOKEN);
export const FALLBACK_GITLAB_TOKEN = getEnv(process.env.FALLBACK_GITLAB_TOKEN);
export const FALLBACK_GITEA_TOKEN = getEnv(process.env.FALLBACK_GITEA_TOKEN);

export const INDEX_CONCURRENCY_MULTIPLE = getEnv(process.env.INDEX_CONCURRENCY_MULTIPLE);
export const REDIS_URL = getEnv(process.env.REDIS_URL, 'redis://localhost:6379')!;

export const SENTRY_DSN = getEnv(process.env.SENTRY_DSN);
export const SENTRY_ENVIRONMENT = getEnv(process.env.SENTRY_ENVIRONMENT, 'unknown')!;
