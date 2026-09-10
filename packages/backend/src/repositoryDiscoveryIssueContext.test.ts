import { describe, expect, test } from "vitest";
import {
    collectRepositoryDiscoveryIssues,
    reportRepositoryDiscoveryIssue,
} from "./repositoryDiscoveryIssueContext.js";

const repositoryIssue = (repository: string) => ({
    code: "NOT_FOUND_OR_INACCESSIBLE" as const,
    effect: "TARGET_SKIPPED" as const,
    subject: {
        kind: "repository" as const,
        value: repository,
    },
    message: `Repository ${repository} was not found or is inaccessible.`,
});

describe("repository discovery issue context", () => {
    test("returns the routine value and collected issues", async () => {
        const issue = repositoryIssue("sourcebot-dev/legacy");

        await expect(
            collectRepositoryDiscoveryIssues(async () => {
                reportRepositoryDiscoveryIssue(issue);
                return ["repository"];
            }),
        ).resolves.toEqual({
            value: ["repository"],
            issues: [issue],
        });
    });

    test("does nothing when reporting outside a collection context", () => {
        expect(() =>
            reportRepositoryDiscoveryIssue(
                repositoryIssue("sourcebot-dev/legacy"),
            )
        ).not.toThrow();
    });

    test("deduplicates identical issues", async () => {
        const issue = repositoryIssue("sourcebot-dev/legacy");

        await expect(
            collectRepositoryDiscoveryIssues(() => {
                reportRepositoryDiscoveryIssue(issue);
                reportRepositoryDiscoveryIssue(issue);
            }),
        ).resolves.toEqual({
            value: undefined,
            issues: [issue],
        });
    });

    test("keeps concurrent collection contexts isolated", async () => {
        let releaseFirst: () => void = () => {};
        const firstCanFinish = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });

        const first = collectRepositoryDiscoveryIssues(async () => {
            reportRepositoryDiscoveryIssue(repositoryIssue("org/first"));
            await firstCanFinish;
            reportRepositoryDiscoveryIssue(
                repositoryIssue("org/first-after-await"),
            );
        });
        const second = collectRepositoryDiscoveryIssues(async () => {
            reportRepositoryDiscoveryIssue(repositoryIssue("org/second"));
            releaseFirst();
        });

        await expect(Promise.all([first, second])).resolves.toEqual([
            {
                value: undefined,
                issues: [
                    repositoryIssue("org/first"),
                    repositoryIssue("org/first-after-await"),
                ],
            },
            {
                value: undefined,
                issues: [repositoryIssue("org/second")],
            },
        ]);
    });

    test("does not retain a context after the routine rejects", async () => {
        await expect(
            collectRepositoryDiscoveryIssues(async () => {
                throw new Error("Discovery failed");
            }),
        ).rejects.toThrow("Discovery failed");

        reportRepositoryDiscoveryIssue(
            repositoryIssue("sourcebot-dev/legacy"),
        );
        await expect(
            collectRepositoryDiscoveryIssues(async () => {}),
        ).resolves.toEqual({ value: undefined, issues: [] });
    });
});
