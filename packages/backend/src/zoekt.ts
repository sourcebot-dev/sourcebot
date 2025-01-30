import { exec } from "child_process";
import { AppContext, GitRepository, LocalRepository, Settings } from "./types.js";

const ALWAYS_EXCLUDED_DIRS = ['.git', '.hg', '.svn'];

export const indexGitRepository = async (repo: GitRepository, settings: Settings, ctx: AppContext) => {
    const revisions = [
        'HEAD',
        ...repo.branches ?? [],
        ...repo.tags ?? [],
    ];
    if (repo.defaultBranch) revisions.push(repo.defaultBranch);

    const command = `zoekt-git-index -allow_missing_branches -index ${ctx.indexPath} -max_trigram_count ${settings.maxTrigramCount} -file_limit ${settings.maxFileSize} -branches ${revisions.join(',')} ${repo.path}`;

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