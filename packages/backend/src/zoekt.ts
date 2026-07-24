import { Repo } from "@sourcebot/db";
import { createLogger, env, getRepoPath } from "@sourcebot/shared";
import { execFile } from "child_process";
import { readdir, rm } from "fs/promises";
import { INDEX_CACHE_DIR } from "./constants.js";
import { Settings } from "./types.js";
import { getShardPrefix } from "./utils.js";

const logger = createLogger('zoekt');

// Patterns that indicate ctags/symbol indexing failure in zoekt output
const CTAGS_ERROR_PATTERNS = [
    /illegal option/i,
    /file already closed/i,
    /ctags.*not found/i,
    /ctags.*error/i,
    /universal:ctags.*error/i,
    /scip:.*error/i,
];

/**
 * Detect ctags/symbol indexing failures from zoekt stderr output.
 * Returns a warning message if ctags failed, or undefined if symbol indexing succeeded.
 */
export const detectCtagsFailure = (stderr: string): string | undefined => {
    const lines = stderr.split('\n').filter(line => line.trim());

    // Check for ctags error patterns
    const hasCtagsError = lines.some(line =>
        CTAGS_ERROR_PATTERNS.some(pattern => pattern.test(line))
    );

    // Check for symbols=0 in the statistics line (indicates no symbols were indexed)
    const statsLine = lines.find(line => /symbol analysis finished.*symbols=0/.test(line));
    const hasZeroSymbols = statsLine !== undefined;

    if (hasCtagsError && hasZeroSymbols) {
        return `ctags symbol indexing failed: ctags reported errors and 0 symbols were indexed. ` +
            `Symbol search (sym:*) will return no results. ` +
            `Check that CTAGS_COMMAND points to a Universal Ctags binary.`;
    }

    if (hasCtagsError) {
        return `ctags reported errors during symbol indexing. ` +
            `Symbol search results may be incomplete. ` +
            `Check that CTAGS_COMMAND points to a Universal Ctags binary.`;
    }

    return undefined;
};

export const indexGitRepository = async (repo: Repo, settings: Settings, revisions: string[], signal?: AbortSignal) => {
    const { path: repoPath } = getRepoPath(repo);
    const shardPrefix = getShardPrefix(repo.orgId, repo.id);

    const largeFileGlobPatterns = env.ALWAYS_INDEX_FILE_PATTERNS?.split(',').map(pattern => pattern.trim()) ?? [];

    const args = [
        '-allow_missing_branches',
        '-index', INDEX_CACHE_DIR,
        '-max_trigram_count', settings.maxTrigramCount.toString(),
        '-file_limit', settings.maxFileSize.toString(),
        '-branches', revisions.join(','),
        '-tenant_id', repo.orgId.toString(),
        '-repo_id', repo.id.toString(),
        '-shard_prefix_override', shardPrefix,
        ...largeFileGlobPatterns.flatMap((pattern) => ['-large_file', pattern]),
        repoPath
    ];

    return new Promise<{ stdout: string, stderr: string; ctagsWarning?: string }>((resolve, reject) => {
        execFile('zoekt-git-index', args, { signal }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }

            if (stdout) {
                stdout.split('\n').filter(line => line.trim()).forEach(line => {
                    logger.debug(line);
                });
            }
            if (stderr) {
                stderr.split('\n').filter(line => line.trim()).forEach(line => {
                    logger.debug(line);
                });
            }

            // Detect ctags/symbol indexing failures
            const ctagsWarning = detectCtagsFailure(stderr ?? '');
            if (ctagsWarning) {
                logger.warn(`[${repo.name}] ${ctagsWarning}`);
            }

            resolve({
                stdout,
                stderr,
                ctagsWarning,
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
            logger.debug(`Cleaning up temp shard file: ${filePath}`);
            await rm(filePath, { force: true });
        }
        
        if (tempFiles.length > 0) {
            logger.debug(`Cleaned up ${tempFiles.length} temp shard file(s) for repo ${repo.id}`);
        }
    } catch (error) {
        // Log but don't throw - cleanup is best effort
        logger.warn(`Failed to cleanup temp shards for repo ${repo.id}:`, error);
    }
}
