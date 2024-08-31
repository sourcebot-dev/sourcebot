
const getEnv = (env: string | undefined, defaultValue = '') => {
	return env ?? defaultValue;
}

export const ZOEKT_WEBSERVER_URL = getEnv(process.env.ZOEKT_WEBSERVER_URL, "http://localhost:6070");

export const NODE_ENV = process.env.NODE_ENV;
