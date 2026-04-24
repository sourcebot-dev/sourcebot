import { sourcebot_pr_payload, sourcebot_file_diff_review } from "@/features/agents/review-agent/types";
import { Gitlab } from "@gitbeaker/rest";
import { createLogger } from "@sourcebot/shared";

// Derive the position type from the Gitlab client to avoid importing from @gitbeaker/core.
type DiscussionNotePosition = NonNullable<
    NonNullable<Parameters<InstanceType<typeof Gitlab>['MergeRequestDiscussions']['create']>[3]>['position']
>;

const logger = createLogger('gitlab-push-mr-reviews');

/**
 * Extracts new-file line numbers for context (unchanged) lines from a snippet.
 * Snippet lines have the format `<lineNum>:<content>` where content starts with
 * a space for context lines, `+` for additions, and `-` for deletions.
 */
function extractContextLineNumbers(snippet: string): number[] {
    const result: number[] = [];
    for (const line of snippet.split('\n')) {
        if (line.startsWith('@@')) {
            continue;
        }
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
            continue;
        }
        const lineNum = parseInt(line.substring(0, colonIdx), 10);
        if (isNaN(lineNum)) {
            continue;
        }
        const content = line.substring(colonIdx + 1);
        if (content.startsWith(' ')) {
            result.push(lineNum);
        }
    }
    return result;
}

/**
 * Builds a per-file map from new-file line number → old-file line number for
 * context lines. Context lines appear at the same index in oldSnippet and
 * newSnippet, so zipping them gives the mapping.
 */
function buildContextLineMap(prPayload: sourcebot_pr_payload): Map<string, Map<number, number>> {
    const fileMap = new Map<string, Map<number, number>>();
    for (const fileDiff of prPayload.file_diffs) {
        const lineMap = new Map<number, number>();
        for (const diff of fileDiff.diffs) {
            const oldNums = extractContextLineNumbers(diff.oldSnippet);
            const newNums = extractContextLineNumbers(diff.newSnippet);
            for (let i = 0; i < Math.min(oldNums.length, newNums.length); i++) {
                lineMap.set(newNums[i], oldNums[i]);
            }
        }
        fileMap.set(fileDiff.to, lineMap);
    }
    return fileMap;
}

export const gitlabPushMrReviews = async (
    gitlabClient: InstanceType<typeof Gitlab>,
    projectId: number,
    prPayload: sourcebot_pr_payload,
    fileDiffReviews: sourcebot_file_diff_review[],
): Promise<void> => {
    logger.info("Executing gitlab_push_mr_reviews");

    if (!prPayload.diff_refs) {
        logger.error("diff_refs is missing from pr_payload, cannot post inline GitLab MR reviews");
        return;
    }

    const { base_sha, head_sha, start_sha } = prPayload.diff_refs;
    const contextLineMap = buildContextLineMap(prPayload);

    for (const fileDiffReview of fileDiffReviews) {
        const fileContextMap = contextLineMap.get(fileDiffReview.filename);
        const resolvedOldPath = fileDiffReview.oldFilename ?? fileDiffReview.filename;
        // GitLab requires both oldPath and newPath in the position object.
        // For added files (old is /dev/null) use the new path for both;
        // for deleted files (new is /dev/null) use the old path for both.
        const oldPath = resolvedOldPath !== '/dev/null' ? resolvedOldPath : fileDiffReview.filename;
        const newPath = fileDiffReview.filename !== '/dev/null' ? fileDiffReview.filename : resolvedOldPath;
        for (const review of fileDiffReview.reviews) {
            const oldLine = fileContextMap?.get(review.line_end);
            const position: DiscussionNotePosition = {
                positionType: 'text',
                baseSha: base_sha,
                headSha: head_sha,
                startSha: start_sha,
                oldPath,
                newPath,
                newLine: String(review.line_end),
                ...(oldLine !== undefined ? { oldLine: String(oldLine) } : {}),
            };
            try {
                await gitlabClient.MergeRequestDiscussions.create(
                    projectId,
                    prPayload.number,
                    review.review,
                    { position },
                );
            } catch (error) {
                // Inline comment failed (e.g. line not in diff) — fall back to a general MR note
                logger.warn(
                    `Inline comment failed for ${fileDiffReview.filename}:${review.line_start}-${review.line_end}, falling back to general note: ${error}`,
                );
                try {
                    await gitlabClient.MergeRequestNotes.create(
                        projectId,
                        prPayload.number,
                        `**${fileDiffReview.filename}** (lines ${review.line_start}–${review.line_end}):\n\n${review.review}`,
                    );
                } catch (fallbackError) {
                    logger.error(
                        `Error posting fallback note for ${fileDiffReview.filename}: ${fallbackError}`,
                    );
                }
            }
        }
    }

    logger.info("Completed gitlab_push_mr_reviews");
};
