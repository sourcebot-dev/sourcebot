import { Logger } from "winston";
import { AppContext, Repository } from "./types.js";
import path from 'path';
import micromatch from "micromatch";

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

export const excludeForkedRepos = <T extends Repository>(repos: T[], logger?: Logger) => {
    return repos.filter((repo) => {
        if (!!repo.isFork) {
            logger?.debug(`Excluding repo ${repo.id}. Reason: exclude.forks is true`);
            return false;
        }
        return true;
    });
}

export const excludeArchivedRepos = <T extends Repository>(repos: T[], logger?: Logger) => {
    return repos.filter((repo) => {
        if (!!repo.isArchived) {
            logger?.debug(`Excluding repo ${repo.id}. Reason: exclude.archived is true`);
            return false;
        }
        return true;
    });
}


export const excludeReposByName = <T extends Repository>(repos: T[], excludedRepoNames: string[], logger?: Logger) => {
    return repos.filter((repo) => {
        if (micromatch.isMatch(repo.name, excludedRepoNames)) {
            logger?.debug(`Excluding repo ${repo.id}. Reason: exclude.repos contains ${repo.name}`);
            return false;
        }
        return true;
    });
}

export const includeReposByName = <T extends Repository>(repos: T[], includedRepoNames: string[], logger?: Logger) => {
    return repos.filter((repo) => {
        if (micromatch.isMatch(repo.name, includedRepoNames)) {
            logger?.debug(`Including repo ${repo.id}. Reason: repos does not contain ${repo.name}`);
            return true;
        }
        return false;
    });
}

export const getTokenFromConfig = (token: string | { env: string }, ctx: AppContext) => {
    if (typeof token === 'string') {
        return token;
    }
    const tokenValue = process.env[token.env];
    if (!tokenValue) {
        throw new Error(`The environment variable '${token.env}' was referenced in ${ctx.configPath}, but was not set.`);
    }
    return tokenValue;
}

export const isRemotePath = (path: string) => {
    return path.startsWith('https://') || path.startsWith('http://');
}

export const resolvePathRelativeToConfig = (localPath: string, configPath: string) => {
    let absolutePath = localPath;
    if (!path.isAbsolute(absolutePath)) {
        if (absolutePath.startsWith('~')) {
            absolutePath = path.join(process.env.HOME ?? '', absolutePath.slice(1));
        }

        absolutePath = path.resolve(path.dirname(configPath), absolutePath);
    }

    return absolutePath;
}

export const arraysEqualShallow = <T>(a?: readonly T[], b?: readonly T[]) => {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    if (a.length !== b.length) return false;

    const aSorted = a.toSorted();
    const bSorted = b.toSorted();

    for (let i = 0; i < aSorted.length; i++) {
        if (aSorted[i] !== bSorted[i]) {
            return false;
        }
    }

    return true;
}
