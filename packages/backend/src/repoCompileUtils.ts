import { GithubConnectionConfig } from '@sourcebot/schemas/v3/github.type';
import { getGitHubReposFromConfig } from "./github.js";
import { Prisma, PrismaClient } from '@sourcebot/db';
import { WithRequired } from "./types.js"
import { marshalBool } from "./utils.js";

export type RepoData = WithRequired<Prisma.RepoCreateInput, 'connections'>;

export const compileGithubConfig = async (
    config: GithubConnectionConfig,
    connectionId: number,
    orgId: number,
    db: PrismaClient,
    abortController: AbortController): Promise<RepoData[]> => {
    const gitHubRepos = await getGitHubReposFromConfig(config, orgId, db, abortController.signal);
    const hostUrl = config.url ?? 'https://github.com';
    const hostname = config.url ? new URL(config.url).hostname : 'github.com';

    return gitHubRepos.map((repo) => {
        const repoName = `${hostname}/${repo.full_name}`;
        const cloneUrl = new URL(repo.clone_url!);

        const record: RepoData = {
            external_id: repo.id.toString(),
            external_codeHostType: 'github',
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl.toString(),
            name: repoName,
            isFork: repo.fork,
            isArchived: !!repo.archived,
            org: {
                connect: {
                    id: orgId,
                },
            },
            connections: {
                create: {
                    connectionId: connectionId,
                }
            },
            metadata: {
                'zoekt.web-url-type': 'github',
                'zoekt.web-url': repo.html_url,
                'zoekt.name': repoName,
                'zoekt.github-stars': (repo.stargazers_count ?? 0).toString(),
                'zoekt.github-watchers': (repo.watchers_count ?? 0).toString(),
                'zoekt.github-subscribers': (repo.subscribers_count ?? 0).toString(),
                'zoekt.github-forks': (repo.forks_count ?? 0).toString(),
                'zoekt.archived': marshalBool(repo.archived),
                'zoekt.fork': marshalBool(repo.fork),
                'zoekt.public': marshalBool(repo.private === false)
            },
        };

        return record;
    })
}