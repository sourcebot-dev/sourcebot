import { Repo } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { exec } from "child_process";
import micromatch from "micromatch";
import { INDEX_CACHE_DIR } from "./constants.js";
import { getBranches, getTags } from "./git.js";
import { captureEvent } from "./posthog.js";
import { repoMetadataSchema, Settings } from "./types.js";
import { getRepoPath, getShardPrefix } from "./utils.js";

const logger = createLogger('zoekt');

export const indexGitRepository = async (repo: Repo, settings: Settings) => {
    let revisions = [
        'HEAD'
    ];

    const { path: repoPath } = getRepoPath(repo);
    const shardPrefix = getShardPrefix(repo.orgId, repo.id);
    const metadata = repoMetadataSchema.parse(repo.metadata);

    if (metadata.branches) {
        const branchGlobs = metadata.branches
        const allBranches = await getBranches(repoPath);
        const matchingBranches = 
            allBranches
                .filter((branch) => micromatch.isMatch(branch, branchGlobs))
                .map((branch) => `refs/heads/${branch}`);

        revisions = [
            ...revisions,
            ...matchingBranches
        ];
    }

    if (metadata.tags) {
        const tagGlobs = metadata.tags;
        const allTags = await getTags(repoPath);
        const matchingTags = 
            allTags
                .filter((tag) => micromatch.isMatch(tag, tagGlobs))
                .map((tag) => `refs/tags/${tag}`);

        revisions = [
            ...revisions,
            ...matchingTags
        ];
    }

    // zoekt has a limit of 64 branches/tags to index.
    if (revisions.length > 64) {
        logger.warn(`Too many revisions (${revisions.length}) for repo ${repo.id}, truncating to 64`);
        captureEvent('backend_revisions_truncated', {
            repoId: repo.id,
            revisionCount: revisions.length,
        });
        revisions = revisions.slice(0, 64);
    }
    
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
        repoPath
    ].join(' ');

    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
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
