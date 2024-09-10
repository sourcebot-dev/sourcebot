
const getEnv = (env: string | undefined, defaultValue = '') => {
	return env ?? defaultValue;
}

const getEnvNumber = (env: string | undefined, defaultValue: number = 0) => {
	return Number(env) ?? defaultValue;
}

export const ZOEKT_WEBSERVER_URL = getEnv(process.env.ZOEKT_WEBSERVER_URL, "http://localhost:6070");
export const SHARD_MAX_MATCH_COUNT = getEnvNumber(process.env.SHARD_MAX_MATCH_COUNT, 10000);
export const TOTAL_MAX_MATCH_COUNT = getEnvNumber(process.env.TOTAL_MAX_MATCH_COUNT, 100000);

export const NODE_ENV = process.env.NODE_ENV;
