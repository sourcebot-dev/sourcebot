import { Repository } from './types.js';
import { simpleGit, SimpleGitProgressEvent } from 'simple-git';
import { existsSync } from 'fs';
import { createLogger } from './logger.js';

const logger = createLogger('git');

export const cloneRepository = async (repo: Repository, onProgress?: (progress: number) => void) => {
    if (existsSync(repo.path)) {
        logger.warn(`${repo.id} already exists. Skipping clone.`)
        return;
    }

    let receivingProgress = 0;
    let resolvingProgress = 0;

    const progress = ({ stage, processed, total }: SimpleGitProgressEvent) => {
        // Guestimate the progress as the average of receiving and resolving stages.
        if (stage === 'receiving') {
            receivingProgress = processed / total;
        }
        if  (stage === 'resolving') {
            resolvingProgress = processed / total;
        }

        const totalProgress = (receivingProgress + resolvingProgress) / 2;
        onProgress?.(totalProgress);
    }

    const git = simpleGit({
        progress
    });

    const gitConfig = Object.entries(repo.gitConfigMetadata ?? {}).flatMap(
        ([key, value]) => ['--config', `${key}=${value}`]
    );

    await git.clone(
        repo.cloneUrl,
        repo.path,
        [
            "--bare",
            ...gitConfig
        ]
    );
}


export const fetchRepository = async (repo: Repository) => {
    const progress = ({ method, stage, progress }: SimpleGitProgressEvent) => {
        console.log(`git.${method} ${stage} stage ${progress}% complete.`);
    }

    const git = simpleGit({
        progress
    });

    await git.cwd({
        path: repo.path,
    }).fetch(
        "origin",
        "HEAD",
        [
            "--prune",
            "--progress"
        ]
    );
}