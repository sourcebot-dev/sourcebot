import Bull from 'bull';
import { simpleGit } from 'simple-git';
import { createLogger } from "../src/logger.js";
import { Repository } from "../src/types.js";
import { existsSync } from 'fs';


const logger = createLogger('git-service');

const CONCURRENCY = 5;

type CloneJob = {
    cloneUrl: string;
    outputPath: string;
}

interface GitService {
    clone (url: string, path: string): void;
    onCloneCompleted (callback: (cloneUrl: string) => void): void;

    syncRepository (repo: Repository): void;
}


const createGitService = (): GitService => {
    const queue = new Bull<CloneJob>('clone-queue');
    const git = simpleGit({
        progress: (event) => {
            console.log(`git.${event.method} ${event.stage} stage ${event.progress}% complete`)
        }
    });

    queue.process(CONCURRENCY, async ({ data }) => {
        logger.debug(`Cloning ${data.cloneUrl} to ${data.outputPath}`);
        await git.clone(
            data.cloneUrl,
            data.outputPath,
            ['--bare']
        );
    });

    return {
        clone: async (url: string, path: string) => {
            const job = await queue.add({
                cloneUrl: url,
                outputPath: path,
            })
            console.log(job);
        },
        onCloneCompleted: (callback) => {
            queue.on('completed', (job) => {
                callback(job.data.cloneUrl);
            })
            queue.on('failed', (job) => {
                console.error(`Clone failed: ${job.data.cloneUrl}`);
            });
        },
        
        syncRepository: (repo) => {
            if (existsSync(repo.path)) {
                
            }
        }
    }
}

// -----


const gitService = createGitService();
gitService.onCloneCompleted((url) => {
    console.log(`Clone completed: ${url}`);
});

console.log('hello world');
gitService.clone('https://github.com/sourcegraph/zoekt', '/tmp/zoekt');
// gitService.clone('https://github.com/facebook/react', '/tmp/react');
// gitService.clone('https://github.com/microsoft/typescript', '/tmp/typescript');
// gitService.clone('https://github.com/nodejs/node', '/tmp/node');
// gitService.clone('https://github.com/kubernetes/kubernetes', '/tmp/kubernetes');
// gitService.clone('https://github.com/tensorflow/tensorflow', '/tmp/tensorflow');


