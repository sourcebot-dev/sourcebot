import { simpleGit, SimpleGitProgressEvent } from 'simple-git';

export const cloneRepository = async (cloneURL: string, path: string, gitConfig?: Record<string, string>, onProgress?: (event: SimpleGitProgressEvent) => void) => {
    const git = simpleGit({
        progress: onProgress,
    });

    const configParams = Object.entries(gitConfig ?? {}).flatMap(
        ([key, value]) => ['--config', `${key}=${value}`]
    );

    await git.clone(
        cloneURL,
        path,
        [
            "--bare",
            ...configParams
        ]
    );

    await git.cwd({
        path,
    }).addConfig("remote.origin.fetch", "+refs/heads/*:refs/heads/*");
}


export const fetchRepository = async (path: string, onProgress?: (event: SimpleGitProgressEvent) => void) => {
    const git = simpleGit({
        progress: onProgress,
    });

    await git.cwd({
        path: path,
    }).fetch(
        "origin",
        [
            "--prune",
            "--progress"
        ]
    );
}
