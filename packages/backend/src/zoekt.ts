import { exec } from "child_process";
import { AppContext, GitRepository, LocalRepository } from "./types.js";

const ALWAYS_EXCLUDED_DIRS = ['.git', '.hg', '.svn'];

export const indexGitRepository = async (repo: GitRepository, ctx: AppContext) => {
    const revisions = [
        'HEAD',
        ...repo.branches ?? [],
        ...repo.tags ?? [],
    ];

    const command = `zoekt-git-index -allow_missing_branches -index ${ctx.indexPath} -branches ${revisions.join(',')} ${repo.path}`;

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

export const indexLocalRepository = async (repo: LocalRepository, ctx: AppContext, signal?: AbortSignal) => {
    const excludedDirs = [...ALWAYS_EXCLUDED_DIRS, repo.excludedPaths];
    const command = `zoekt-index -index ${ctx.indexPath} -ignore_dirs ${excludedDirs.join(',')} ${repo.path}`;

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