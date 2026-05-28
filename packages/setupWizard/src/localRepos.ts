import { input } from '@inquirer/prompts';
import { tabCheckbox as checkbox } from './tabCheckbox.js';
import { existsSync, statSync } from 'fs';
import { readdir } from 'fs/promises';
import { homedir } from 'os';
import { basename, join, relative, resolve } from 'path';
import ora from 'ora';
import type { GenericGitHostConnectionConfig } from '@sourcebot/schemas/v3/genericGitHost.type';
import type { CollectResult } from './utils.js';
import { note } from './utils.js';

const MAX_DEPTH = 5;

const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    'build',
    'out',
    'target',
    'vendor',
    'coverage',
    '__pycache__',
]);

function expandHostPath(p: string): string {
    const trimmed = p.trim();
    if (trimmed.startsWith('~')) {
        return resolve(join(homedir(), trimmed.slice(1)));
    }
    return resolve(trimmed);
}

async function findGitRepos(root: string, maxDepth: number): Promise<string[]> {
    const repos: string[] = [];

    async function walk(dir: string, depth: number): Promise<void> {
        if (existsSync(join(dir, '.git'))) {
            repos.push(dir);
            return;
        }
        if (depth >= maxDepth) {
            return;
        }
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            if (entry.name.startsWith('.')) {
                continue;
            }
            if (SKIP_DIRS.has(entry.name)) {
                continue;
            }
            await walk(join(dir, entry.name), depth + 1);
        }
    }

    await walk(root, 0);
    return repos.sort();
}

export async function collectLocalReposConfig(
    localRepoIndex: Map<string, number>,
): Promise<CollectResult> {
    note(
        [
            'Point at a directory on your machine that contains git repositories.',
            `The wizard will scan up to ${MAX_DEPTH} levels deep and let you pick which to index.`,
            'Local repos are treated as read-only.',
        ].join('\n'),
        'Local Git repositories',
    );

    let hostPath: string;
    let repos: string[];

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const rawPath = await input({
            message: 'Path to your repos directory (e.g. ~/code)',
            validate: (v) => {
                if (!v?.trim()) {
                    return 'Path is required';
                }
                const resolved = expandHostPath(v);
                if (!existsSync(resolved)) {
                    return `Path does not exist: ${resolved}`;
                }
                if (!statSync(resolved).isDirectory()) {
                    return `Not a directory: ${resolved}`;
                }
                return true;
            },
        });

        hostPath = expandHostPath(rawPath);

        const spinner = ora(`Scanning ${hostPath} for git repositories...`).start();
        repos = await findGitRepos(hostPath, MAX_DEPTH);
        if (repos.length === 0) {
            spinner.fail(`No git repositories found under ${hostPath}`);
            continue;
        }
        spinner.succeed(`Found ${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'}`);
        break;
    }

    let index = localRepoIndex.get(hostPath);
    if (index === undefined) {
        index = localRepoIndex.size;
        localRepoIndex.set(hostPath, index);
    }
    const containerRoot = `/repos/${index}`;

    const hostPathIsRepo = repos.length === 1 && repos[0] === hostPath;
    if (hostPathIsRepo) {
        return {
            connections: [{
                name: basename(hostPath),
                config: {
                    type: 'git',
                    url: `file://${containerRoot}`,
                } satisfies GenericGitHostConnectionConfig,
            }],
            env: {},
            localRepoHostPath: hostPath,
        };
    }

    const choices = repos.map((repoPath) => ({
        name: relative(hostPath, repoPath) || basename(repoPath),
        value: repoPath,
        checked: true,
    }));

    const selected = await checkbox<string>({
        message: 'Which repositories should be indexed?',
        choices,
        required: true,
        pageSize: 15,
        loop: false,
    });

    const posixRel = (p: string): string => relative(hostPath, p).split('\\').join('/');

    const allSelected = selected.length === repos.length;
    const allAtDepthOne = repos.every((p) => !posixRel(p).includes('/'));

    const connections = allSelected && allAtDepthOne
        ? [{
            config: {
                type: 'git',
                url: `file://${containerRoot}/*`,
            } satisfies GenericGitHostConnectionConfig,
        }]
        : selected.map((repoPath) => {
            const config: GenericGitHostConnectionConfig = {
                type: 'git',
                url: `file://${containerRoot}/${posixRel(repoPath)}`,
            };
            return { name: basename(repoPath), config };
        });

    return { connections, env: {}, localRepoHostPath: hostPath };
}
