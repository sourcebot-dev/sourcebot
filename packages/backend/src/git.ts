import { simpleGit, SimpleGitProgressEvent } from 'simple-git';

export const cloneRepository = async (cloneURL: string, path: string, gitConfig?: Record<string, string>, onProgress?: (event: SimpleGitProgressEvent) => void) => {
    const git = simpleGit({
        progress: onProgress,
    });

    const configParams = Object.entries(gitConfig ?? {}).flatMap(
        ([key, value]) => ['--config', `${key}=${value}`]
    );

    try {
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
    } catch (error) {
        throw new Error(`Failed to clone repository`);
    }
}


export const fetchRepository = async (path: string, onProgress?: (event: SimpleGitProgressEvent) => void) => {
    const git = simpleGit({
        progress: onProgress,
    });

    try {
        await git.cwd({
            path: path,
        }).fetch(
            "origin",
            [
                "--prune",
                "--progress"
            ]
        );
    } catch (error) {
        throw new Error(`Failed to fetch repository ${path}`);
    }
}

export const getBranches = async (path: string) => {
    const git = simpleGit();
    const branches = await git.cwd({
        path,
    }).branch();

    return branches.all;
}

export const getTags = async (path: string) => {
    const git = simpleGit();
    const tags = await git.cwd({
        path,
    }).tags();
    return tags.all;
}