import {
    repositoryDiscoveryIssueSchema,
    type RepositoryDiscoveryIssue,
} from "@sourcebot/shared";
import { AsyncLocalStorage } from "node:async_hooks";

interface RepositoryDiscoveryIssueContext {
    issuesByKey: Map<string, RepositoryDiscoveryIssue>;
}

export interface RepositoryDiscoveryIssueCollection<T> {
    value: T;
    issues: RepositoryDiscoveryIssue[];
}

const repositoryDiscoveryIssueStorage =
    new AsyncLocalStorage<RepositoryDiscoveryIssueContext>();

const getIssueKey = (issue: RepositoryDiscoveryIssue): string =>
    JSON.stringify([
        issue.code,
        issue.effect,
        issue.subject?.kind ?? null,
        issue.subject?.value ?? null,
        issue.message,
    ]);

export const collectRepositoryDiscoveryIssues = async <T>(
    routine: () => T | Promise<T>,
): Promise<RepositoryDiscoveryIssueCollection<T>> => {
    const context: RepositoryDiscoveryIssueContext = {
        issuesByKey: new Map(),
    };

    const value = await repositoryDiscoveryIssueStorage.run(context, routine);

    return {
        value,
        issues: [...context.issuesByKey.values()],
    };
};

export const reportRepositoryDiscoveryIssue = (
    issue: RepositoryDiscoveryIssue,
): void => {
    const context = repositoryDiscoveryIssueStorage.getStore();
    if (!context) {
        return;
    }

    const parsedIssue = repositoryDiscoveryIssueSchema.parse(issue);
    context.issuesByKey.set(getIssueKey(parsedIssue), parsedIssue);
};
