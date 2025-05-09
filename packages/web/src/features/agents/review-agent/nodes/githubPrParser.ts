import { sourcebot_pr_payload, sourcebot_file_diff, sourcebot_diff } from "@/features/agents/review-agent/types";
import { WebhookEventDefinition } from "@octokit/webhooks/types";
import parse from "parse-diff";
import { Octokit } from "octokit";

export const githubPrParser = async (octokit: Octokit, payload: WebhookEventDefinition<"pull-request-opened"> | WebhookEventDefinition<"pull-request-synchronize">): Promise<sourcebot_pr_payload> => {
    console.log("Executing github_pr_parser");

    if (!payload.installation) {
        throw new Error("Installation not found in github payload");
    }

    let parsedDiff: parse.File[] = [];  
    try {
        const diff = await octokit.request(payload.pull_request.patch_url);
        parsedDiff = parse(diff.data);
    } catch (error) {
        console.error("Error fetching diff: ", error);
        throw error;
    }

    const sourcebotFileDiffs: (sourcebot_file_diff | null)[] = parsedDiff.map((file) => {
        if (!file.from || !file.to) {
            console.log(`Skipping file due to missing from (${file.from}) or to (${file.to})`)
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

    console.log("Completed github_pr_parser");
    return {
        title: payload.pull_request.title,
        description: payload.pull_request.body ?? "",
        hostDomain: "github.com",
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        file_diffs: filteredSourcebotFileDiffs,
        number: payload.pull_request.number,
        head_sha: payload.pull_request.head.sha,
        installation_id: payload.installation!.id,
    }
}