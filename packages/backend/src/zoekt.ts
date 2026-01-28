import { Repo } from "@sourcebot/db";
import { createLogger, env, getRepoPath } from "@sourcebot/shared";
import { exec } from "child_process";
import { readdir, rm } from "fs/promises";
import { INDEX_CACHE_DIR } from "./constants.js";
import { Settings } from "./types.js";
import { getShardPrefix } from "./utils.js";

const logger = createLogger('zoekt');

export const indexGitRepository = async (repo: Repo, settings: Settings, revisions: string[], signal?: AbortSignal) => {
    const { path: repoPath } = getRepoPath(repo);
    const shardPrefix = getShardPrefix(repo.orgId, repo.id);

    const largeFileGlobPatterns = env.ALWAYS_INDEX_FILE_PATTERNS?.split(',').map(pattern => pattern.trim()) ?? [];

    const command = [
        'zoekt-git-index',
        '-allow_missing_branches',
        `-index ${INDEX_CACHE_DIR}`,
        `-max_trigram_count ${settings.maxTrigramCount}`,
        `-file_limit ${settings.maxFileSize}`,
        `-branches "${revisions.join(',')}"`,
        `-tenant_id ${repo.orgId}`,
        `-repo_id ${repo.id}`,
        `-shard_prefix ${shardPrefix}`,
        ...largeFileGlobPatterns.map((pattern) => `-large_file "${pattern}"`),
        repoPath
    ].join(' ');

    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        exec(command, { signal }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }

            if (stdout) {
                stdout.split('\n').filter(line => line.trim()).forEach(line => {
                    logger.info(line);
                });
            }
            if (stderr) {
                stderr.split('\n').filter(line => line.trim()).forEach(line => {
                    // TODO: logging as regular info here and not error because non error logs are being
                    // streamed in stderr and incorrectly being logged as errors at a high level
                    logger.info(line);
                });
            }

            resolve({
                stdout,
                stderr
            });
        })
    });
}

/**
 * Cleans up temporary shard files left behind by a failed indexing operation.
 * Zoekt creates temporary files (with `.tmp` suffix) during indexing, which
 * can be left behind if the indexing process fails or is interrupted.
 * 
 * @param repo - The repository whose temp shards should be cleaned up
 */
export const cleanupTempShards = async (repo: Repo) => {
    const shardPrefix = getShardPrefix(repo.orgId, repo.id);
    
    try {
        const files = await readdir(INDEX_CACHE_DIR);
        const tempFiles = files.filter(file => 
            file.startsWith(shardPrefix) && file.includes('.tmp')
        );
        
        for (const file of tempFiles) {
            const filePath = `${INDEX_CACHE_DIR}/${file}`;
            logger.info(`Cleaning up temp shard file: ${filePath}`);
            await rm(filePath, { force: true });
        }
        
        if (tempFiles.length > 0) {
            logger.info(`Cleaned up ${tempFiles.length} temp shard file(s) for repo ${repo.id}`);
        }
    } catch (error) {
        // Log but don't throw - cleanup is best effort
        logger.warn(`Failed to cleanup temp shards for repo ${repo.id}:`, error);
    }
}
