import { CodeHostType } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import path from "path";

export const SINGLE_TENANT_ORG_ID = 1;

export const PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES: CodeHostType[] = [
    'github',
    'gitlab',
];

export const REPOS_CACHE_DIR = path.join(env.DATA_CACHE_DIR, 'repos');
export const INDEX_CACHE_DIR = path.join(env.DATA_CACHE_DIR, 'index');