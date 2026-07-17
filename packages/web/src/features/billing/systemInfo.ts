import os from "node:os";
import fs from "node:fs/promises";
import { env, createLogger, type SystemInfo } from "@sourcebot/shared";

const logger = createLogger('system-info');

// cgroup v2 (unified hierarchy).
const CGROUP_V2_MEMORY_MAX = '/sys/fs/cgroup/memory.max';
const CGROUP_V2_MEMORY_CURRENT = '/sys/fs/cgroup/memory.current';
const CGROUP_V2_CPU_MAX = '/sys/fs/cgroup/cpu.max';

// cgroup v1 (legacy hierarchy).
const CGROUP_V1_MEMORY_LIMIT = '/sys/fs/cgroup/memory/memory.limit_in_bytes';
const CGROUP_V1_MEMORY_USAGE = '/sys/fs/cgroup/memory/memory.usage_in_bytes';
const CGROUP_V1_CPU_QUOTA = '/sys/fs/cgroup/cpu/cpu.cfs_quota_us';
const CGROUP_V1_CPU_PERIOD = '/sys/fs/cgroup/cpu/cpu.cfs_period_us';

/**
 * Collects a snapshot of the resources this deployment is running with, so we
 * can quickly diagnose resource issues (e.g. "the customer doesn't have enough
 * RAM") from the service ping.
 *
 * Everything is best-effort: any value we can't read is reported as `null` so a
 * partial snapshot still goes out. Resource figures come from the container's
 * cgroup (and `statfs` for disk) rather than host-level readings, which in a
 * Dockerized or Kubernetes deployment report the underlying machine, not the
 * container's actual limits.
 */
export const getSystemInfo = async (): Promise<SystemInfo> => {
    const [memoryLimitBytes, memoryUsedBytes, cpuQuota, disk] = await Promise.all([
        readCgroupMemoryLimit(),
        readCgroupMemoryUsage(),
        readCgroupCpuQuota(),
        readDiskUsage(env.DATA_CACHE_DIR),
    ]);

    return {
        platform: os.platform(),
        arch: os.arch(),
        cpuQuota,
        memoryLimitMiB: memoryLimitBytes === null ? null : bytesToMiB(memoryLimitBytes),
        memoryUsedMiB: memoryUsedBytes === null ? null : bytesToMiB(memoryUsedBytes),
        diskTotalMiB: disk.totalBytes === null ? null : bytesToMiB(disk.totalBytes),
        diskFreeMiB: disk.freeBytes === null ? null : bytesToMiB(disk.freeBytes),
    };
};

const BYTES_PER_MIB = 1024 * 1024;

// Memory and disk are both reported in whole MiB (binary, 1024-based units),
// matching how RAM and container/k8s volumes are sized.
const bytesToMiB = (bytes: number): number => Math.round(bytes / BYTES_PER_MIB);

const readFileTrimmed = async (path: string): Promise<string | null> => {
    try {
        const contents = await fs.readFile(path, 'utf8');
        return contents.trim();
    } catch {
        // The file won't exist outside of a cgroup-managed environment (e.g.
        // local dev on macOS), which is expected — treat as "unknown".
        return null;
    }
};

/**
 * Parses a byte count from a cgroup file, returning `null` for "unlimited":
 * the literal `max` in cgroup v2, or a sentinel larger than JS can safely
 * represent in cgroup v1 (e.g. 9223372036854771712).
 */
const parseCgroupBytes = (raw: string | null): number | null => {
    if (raw === null || raw === 'max') {
        return null;
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) {
        return null;
    }
    return value;
};

const readCgroupMemoryLimit = async (): Promise<number | null> => {
    const v2 = parseCgroupBytes(await readFileTrimmed(CGROUP_V2_MEMORY_MAX));
    if (v2 !== null) {
        return v2;
    }
    return parseCgroupBytes(await readFileTrimmed(CGROUP_V1_MEMORY_LIMIT));
};

const readCgroupMemoryUsage = async (): Promise<number | null> => {
    const v2 = parseCgroupBytes(await readFileTrimmed(CGROUP_V2_MEMORY_CURRENT));
    if (v2 !== null) {
        return v2;
    }
    return parseCgroupBytes(await readFileTrimmed(CGROUP_V1_MEMORY_USAGE));
};

/**
 * Returns the effective CPU limit in cores (e.g. 0.5, 2), or `null` when there
 * is no quota (unlimited) or it can't be read.
 */
const readCgroupCpuQuota = async (): Promise<number | null> => {
    // cgroup v2: `cpu.max` is "<quota> <period>" (in microseconds), or
    // "max <period>" when unlimited.
    const v2 = await readFileTrimmed(CGROUP_V2_CPU_MAX);
    if (v2 !== null) {
        const [quotaRaw, periodRaw] = v2.split(/\s+/);
        if (quotaRaw === 'max') {
            return null;
        }
        const quota = Number(quotaRaw);
        const period = Number(periodRaw);
        if (Number.isFinite(quota) && quota > 0 && Number.isFinite(period) && period > 0) {
            return roundToTwo(quota / period);
        }
        return null;
    }

    // cgroup v1: cpu.cfs_quota_us / cpu.cfs_period_us; a quota of -1 is unlimited.
    const quota = Number(await readFileTrimmed(CGROUP_V1_CPU_QUOTA));
    const period = Number(await readFileTrimmed(CGROUP_V1_CPU_PERIOD));
    if (!Number.isFinite(quota) || quota <= 0 || !Number.isFinite(period) || period <= 0) {
        return null;
    }
    return roundToTwo(quota / period);
};

const readDiskUsage = async (path: string): Promise<{ totalBytes: number | null; freeBytes: number | null }> => {
    try {
        const stats = await fs.statfs(path);
        return {
            totalBytes: stats.blocks * stats.bsize,
            // bavail is blocks available to unprivileged users, which best
            // reflects what the deployment can actually write.
            freeBytes: stats.bavail * stats.bsize,
        };
    } catch (error) {
        logger.debug(`Failed to read disk usage for ${path}: ${error}`);
        return { totalBytes: null, freeBytes: null };
    }
};

const roundToTwo = (n: number): number => Math.round(n * 100) / 100;
