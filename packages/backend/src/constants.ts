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

// Maximum time to wait for current job to finish
export const WORKER_STOP_GRACEFUL_TIMEOUT_MS = 5 * 1000; // 5 seconds

// List of shutdown signals
export const SHUTDOWN_SIGNALS: string[] = [
    'SIGHUP',
    'SIGINT',
    'SIGQUIT',
    'SIGILL',
    'SIGTRAP',
    'SIGABRT',
    'SIGBUS',
    'SIGFPE',
    'SIGSEGV',
    'SIGUSR2',
    'SIGTERM',
    // @note: SIGKILL and SIGSTOP cannot have listeners installed.
    // @see: https://nodejs.org/api/process.html#signal-events
];
