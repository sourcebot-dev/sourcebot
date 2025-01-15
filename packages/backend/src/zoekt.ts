import { exec } from "child_process";
import { AppContext, LocalRepository, Settings } from "./types.js";
import { Repo } from "@sourcebot/db";
import { getRepoPath } from "./utils.js";
import { DEFAULT_SETTINGS } from "./constants.js";

const ALWAYS_EXCLUDED_DIRS = ['.git', '.hg', '.svn'];

export const indexGitRepository = async (repo: Repo, ctx: AppContext) => {
    const revisions = [
        'HEAD'
    ];
    
    const tenantId = repo.tenantId ?? 0;
    const shardPrefix = `${tenantId}_${repo.id}`;

    const repoPath = getRepoPath(repo, ctx);
    const command = `zoekt-git-index -allow_missing_branches -index ${ctx.indexPath} -file_limit ${DEFAULT_SETTINGS.maxFileSize} -branches ${revisions.join(',')} -tenant_id ${tenantId} -shard_prefix ${shardPrefix} ${repoPath}`;

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

export const indexLocalRepository = async (repo: LocalRepository, settings: Settings, ctx: AppContext, signal?: AbortSignal) => {
    const excludedDirs = [...ALWAYS_EXCLUDED_DIRS, repo.excludedPaths];
    const command = `zoekt-index -index ${ctx.indexPath} -file_limit ${settings.maxFileSize} -ignore_dirs ${excludedDirs.join(',')} ${repo.path}`;

    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        exec(command, { signal }, (error, stdout, stderr) => {
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