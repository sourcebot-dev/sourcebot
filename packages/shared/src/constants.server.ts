import { env } from "./env.server.js";
import path from "path";

// Guard against env.DATA_CACHE_DIR being undefined (e.g., when SKIP_ENV_VALIDATION=1)
// Use fallback to prevent module load errors in non-runtime contexts like builds
export const REPOS_CACHE_DIR = env.DATA_CACHE_DIR ? path.join(env.DATA_CACHE_DIR, 'repos') : '/tmp/sourcebot/repos';
export const INDEX_CACHE_DIR = env.DATA_CACHE_DIR ? path.join(env.DATA_CACHE_DIR, 'index') : '/tmp/sourcebot/index';
