import { Logger } from "winston";
import { Repository } from "./types.js";

export const measure = async <T>(cb : () => Promise<T>) => {
    const start = Date.now();
    const data = await cb();
    const durationMs = Date.now() - start;
    return {
        data,
        durationMs
    }
}

export const marshalBool = (value?: boolean) => {
    return !!value ? '1' : '0';
}

export const excludeForkedRepos = (repos: Repository[], logger?: Logger) => {
    return repos.filter((repo) => {
        if (repo.isFork) {
            logger?.debug(`Excluding repo ${repo.id}. Reason: exclude.forks is true`);
            return false;
        }
        return true;
    });
}

export const excludeArchivedRepos = (repos: Repository[], logger?: Logger) => {
    return repos.filter((repo) => {
        if (repo.isArchived) {
            logger?.debug(`Excluding repo ${repo.id}. Reason: exclude.archived is true`);
            return false;
        }
        return true;
    });
}

export const excludeReposByName = (repos: Repository[], excludedRepoNames: string[], logger?: Logger) => {
    const excludedRepos = new Set(excludedRepoNames);
    return repos.filter((repo) => {
        if (excludedRepos.has(repo.name)) {
            logger?.debug(`Excluding repo ${repo.id}. Reason: exclude.repos contains ${repo.name}`);
            return false;
        }
        return true;
    });
}