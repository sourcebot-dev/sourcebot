import { exec } from "child_process";
import { AppContext } from "./types.js";
import { Repo } from "@sourcebot/db";
import { getRepoPath } from "./utils.js";
import { DEFAULT_SETTINGS } from "./constants.js";
import { getShardPrefix } from "./utils.js";

export const indexGitRepository = async (repo: Repo, ctx: AppContext) => {
    const revisions = [
        'HEAD'
    ];
    
    const shardPrefix = getShardPrefix(repo.orgId, repo.id);
    const repoPath = getRepoPath(repo, ctx);
    const command = `zoekt-git-index -allow_missing_branches -index ${ctx.indexPath} -file_limit ${DEFAULT_SETTINGS.maxFileSize} -branches ${revisions.join(',')} -tenant_id ${repo.orgId} -shard_prefix ${shardPrefix} ${repoPath}`;

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
