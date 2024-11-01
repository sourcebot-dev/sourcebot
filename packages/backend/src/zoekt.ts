import { exec } from "child_process";
import { AppContext, GitRepository, LocalRepository } from "./types.js";

export const indexGitRepository = async (repo: GitRepository, ctx: AppContext) => {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        exec(`zoekt-git-index -index ${ctx.indexPath} ${repo.path}`, (error, stdout, stderr) => {
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

export const indexLocalRepository = async (repo: LocalRepository, ctx: AppContext) => {
    const excludedDirs = repo.excludedPaths.length > 0 ? repo.excludedPaths : ['.git', '.hg', '.svn'];
    const command = `zoekt-index -index ${ctx.indexPath} -ignore_dirs ${excludedDirs.join(',')} ${repo.path}`;

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