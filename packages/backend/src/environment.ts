import dotenv from 'dotenv';

export const getEnv = (env: string | undefined, defaultValue?: string) => {
	return env ?? defaultValue;
}

export const getEnvBoolean = (env: string | undefined, defaultValue: boolean) => {
	if (!env) {
		return defaultValue;
	}
	return env === 'true' || env === '1';
}

export const getEnvNumber = (env: number | undefined, defaultValue: number ) => {
	if (!env) {
		return defaultValue;
	}
	return env;
}

dotenv.config({
	path: './.env',
});

export const SOURCEBOT_LOG_LEVEL = getEnv(process.env.SOURCEBOT_LOG_LEVEL, 'info')!;
export const SOURCEBOT_TELEMETRY_DISABLED = getEnvBoolean(process.env.SOURCEBOT_TELEMETRY_DISABLED, false)!;
export const SOURCEBOT_INSTALL_ID = getEnv(process.env.SOURCEBOT_INSTALL_ID, 'unknown')!;
export const SOURCEBOT_VERSION = getEnv(process.env.SOURCEBOT_VERSION, 'unknown')!;
export const POSTHOG_PAPIK = getEnv(process.env.POSTHOG_PAPIK);
export const POSTHOG_HOST = getEnv(process.env.POSTHOG_HOST);
export const REINDEX_INTERVAL_MS = getEnvNumber(Number(process.env.REINDEX_INTERVAL_MS), 1000*60*60 )!;
export const RESYNC_CONFIG_INTERVAL_MS = getEnvNumber(Number(process.env.RESYNC_CONFIG_INTERVAL_MS), 1000*60*60*24 )!;
