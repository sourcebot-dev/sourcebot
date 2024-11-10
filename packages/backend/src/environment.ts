import dotenv from 'dotenv';

export const getEnv = (env: string | undefined, defaultValue = '') => {
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

export const SOURCEBOT_LOG_LEVEL = getEnv(process.env.SOURCEBOT_LOG_LEVEL, 'info');
export const SOURCEBOT_TELEMETRY_DISABLED = getEnvBoolean(process.env.SOURCEBOT_TELEMETRY_DISABLED, false);
export const SOURCEBOT_INSTALL_ID = getEnv(process.env.SOURCEBOT_INSTALL_ID, 'unknown');
export const SOURCEBOT_VERSION = getEnv(process.env.SOURCEBOT_VERSION, 'unknown');
export const POSTHOG_KEY = getEnv(process.env.POSTHOG_KEY);
export const POSTHOG_HOST = getEnv(process.env.POSTHOG_HOST);
