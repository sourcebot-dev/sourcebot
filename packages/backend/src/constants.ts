import { env } from "./env.js";
import path from "path";

export const PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES = [
    'github',
];

export const REPOS_CACHE_DIR = path.join(env.DATA_CACHE_DIR, 'repos');
export const INDEX_CACHE_DIR = path.join(env.DATA_CACHE_DIR, 'index');