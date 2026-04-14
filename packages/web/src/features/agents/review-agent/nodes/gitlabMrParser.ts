import { sourcebot_pr_payload, sourcebot_file_diff, sourcebot_diff } from "@/features/agents/review-agent/types";
import { GitLabMergeRequestPayload } from "@/features/agents/review-agent/types";
import parse from "parse-diff";
import { Gitlab } from "@gitbeaker/rest";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('gitlab-mr-parser');

export const gitlabMrParser = async (
    gitlabClient: InstanceType<typeof Gitlab>,
    mrPayload: GitLabMergeRequestPayload,
    hostDomain: string,
): Promise<sourcebot_pr_payload> => {
    logger.debug("Executing gitlab_mr_parser");

    const projectId = mrPayload.project.id;
    const mrIid = mrPayload.object_attributes.iid;

    // Fetch the full MR from the API to guarantee diff_refs and last_commit are present.
    // The webhook payload omits or nulls diff_refs on some action types (e.g. "update").
    let mr: Awaited<ReturnType<typeof gitlabClient.MergeRequests.show>>;
    let fileDiffs: Awaited<ReturnType<typeof gitlabClient.MergeRequests.allDiffs>> = [];
    try {
        [mr, fileDiffs] = await Promise.all([
            gitlabClient.MergeRequests.show(projectId, mrIid),
            gitlabClient.MergeRequests.allDiffs(projectId, mrIid),
        ]);
    } catch (error) {
        logger.error("Error fetching MR data: ", error);
        throw error;
    }

    const namespace = mrPayload.project.path_with_namespace.split('/').slice(0, -1).join('/');
    const repoName = mrPayload.project.name;

    const sourcebotFileDiffs: (sourcebot_file_diff | null)[] = fileDiffs.map((fileDiff) => {
        const fromPath = fileDiff.old_path as string;
        const toPath = fileDiff.new_path as string;

        if (!fromPath || !toPath) {
            logger.debug(`Skipping file due to missing old_path (${fromPath}) or new_path (${toPath})`);
            return null;
        }

        if (!fileDiff.diff) {
            logger.debug(`Skipping file ${toPath} due to empty diff`);
            return null;
        }

        // Construct a standard unified diff header so parse-diff can process it
        const unifiedDiff = `--- a/${fromPath}\n+++ b/${toPath}\n${fileDiff.diff}`;
        const parsed = parse(unifiedDiff);
        if (parsed.length === 0) {
            return null;
        }

        const parsedFile = parsed[0];
        const diffs: sourcebot_diff[] = parsedFile.chunks.map((chunk) => {
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
                oldSnippet,
                newSnippet,
            };
        });

        return {
            from: fromPath,
            to: toPath,
            diffs,
        };
    });

    const filteredSourcebotFileDiffs: sourcebot_file_diff[] = sourcebotFileDiffs.filter(
        (file): file is sourcebot_file_diff => file !== null,
    );

    logger.debug("Completed gitlab_mr_parser");
    return {
        title: mr.title,
        description: mr.description ?? "",
        hostDomain,
        owner: namespace,
        repo: repoName,
        file_diffs: filteredSourcebotFileDiffs,
        number: mrIid,
        head_sha: mr.sha ?? "",
        diff_refs: mr.diff_refs != null
            ? mr.diff_refs as { base_sha: string; head_sha: string; start_sha: string }
            : undefined,
    };
};
