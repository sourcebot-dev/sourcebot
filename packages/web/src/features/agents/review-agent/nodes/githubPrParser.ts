import { sourcebot_pr_payload, sourcebot_file_diff, sourcebot_diff } from "@/features/agents/review-agent/types";
import parse from "parse-diff";
import { Octokit } from "octokit";
import { GitHubPullRequest } from "@/features/agents/review-agent/types";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('github-pr-parser');

export const githubPrParser = async (octokit: Octokit, pullRequest: GitHubPullRequest): Promise<sourcebot_pr_payload> => {
    logger.debug("Executing github_pr_parser");

    let parsedDiff: parse.File[] = [];  
    try {
        const diff = await octokit.request(pullRequest.diff_url);
        parsedDiff = parse(diff.data);
    } catch (error) {
        logger.error("Error fetching diff: ", error);
        throw error;
    }

    const sourcebotFileDiffs: (sourcebot_file_diff | null)[] = parsedDiff.map((file) => {
        if (!file.from || !file.to) {
            logger.debug(`Skipping file due to missing from (${file.from}) or to (${file.to})`)
            return null;
        }

        const diffs: sourcebot_diff[] = file.chunks.map((chunk) => {
            let oldSnippet = `@@ -${chunk.oldStart},${chunk.oldLines} +${chunk.newStart},${chunk.newLines} @@\n`;
            let newSnippet = `@@ -${chunk.oldStart},${chunk.oldLines} +${chunk.newStart},${chunk.newLines} @@\n`;

            for (const change of chunk.changes) {
                if (change.type === "normal") {
                    oldSnippet += change.ln1 + ":" + change.content + "\n";
                    newSnippet += change.ln2 + ":" + change.content + "\n";
                } else if (change.type === "add") {
                    newSnippet += change.ln + ":" + change.content + "\n";
                } else if (change.type === "del") {
                    oldSnippet += change.ln + ":" + change.content + "\n";
                }
            }

            return {
                oldSnippet: oldSnippet,
                newSnippet: newSnippet,
            }
        });

        return {
            from: file.from,
            to: file.to,
            diffs: diffs,
        }
    });
    const filteredSourcebotFileDiffs: sourcebot_file_diff[] = sourcebotFileDiffs.filter((file) => file !== null) as sourcebot_file_diff[];

    logger.debug("Completed github_pr_parser");
    return {
        title: pullRequest.title,
        description: pullRequest.body ?? "",
        hostDomain: "github.com",
        owner: pullRequest.base.repo.owner.login,
        repo: pullRequest.base.repo.name,
        file_diffs: filteredSourcebotFileDiffs,
        number: pullRequest.number,
        head_sha: pullRequest.head.sha
    }
}