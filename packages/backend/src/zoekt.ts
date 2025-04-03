import { exec } from "child_process";
import { AppContext, repoMetadataSchema, Settings } from "./types.js";
import { Repo } from "@sourcebot/db";
import { getRepoPath } from "./utils.js";
import { getShardPrefix } from "./utils.js";
import { getBranches, getTags } from "./git.js";
import micromatch from "micromatch";
import { createLogger } from "./logger.js";
import { captureEvent } from "./posthog.js";

const logger = createLogger('zoekt');

export const indexGitRepository = async (repo: Repo, settings: Settings, ctx: AppContext) => {
    let revisions = [
        'HEAD'
    ];

    const repoPath = getRepoPath(repo, ctx);
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
        `-index ${ctx.indexPath}`,
        `-max_trigram_count ${settings.maxTrigramCount}`,
        `-file_limit ${settings.maxFileSize}`,
        `-branches ${revisions.join(',')}`,
        `-tenant_id ${repo.orgId}`,
        `-shard_prefix ${shardPrefix}`,
        repoPath
    ].join(' ');

    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve({
                stdout,
                stderr
            });
        })
    });
}
