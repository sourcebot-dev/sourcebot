import 'server-only';

import { getEnv, getEnvNumber } from "./utils";

export const ZOEKT_WEBSERVER_URL = getEnv(process.env.ZOEKT_WEBSERVER_URL, "http://localhost:6070")!;
export const SHARD_MAX_MATCH_COUNT = getEnvNumber(process.env.SHARD_MAX_MATCH_COUNT, 10000);
export const TOTAL_MAX_MATCH_COUNT = getEnvNumber(process.env.TOTAL_MAX_MATCH_COUNT, 100000);
export const NODE_ENV = process.env.NODE_ENV;

export const AUTH_JS_SECRET = getEnv(process.env.AUTH_JS_SECRET); // Generate using `npx auth secret`
export const AUTH_GITHUB_CLIENT_ID = getEnv(process.env.AUTH_GITHUB_CLIENT_ID);
export const AUTH_GITHUB_CLIENT_SECRET = getEnv(process.env.AUTH_GITHUB_CLIENT_SECRET);