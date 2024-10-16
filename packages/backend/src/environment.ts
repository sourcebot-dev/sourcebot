
export const getEnv = (env: string | undefined, defaultValue = '') => {
	return env ?? defaultValue;
}

export const SOURCEBOT_LOG_LEVEL = getEnv(process.env.SOURCEBOT_LOG_LEVEL, 'info');
