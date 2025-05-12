import { components } from "@octokit/openapi-types";
import { z } from "zod";

export type GitHubPullRequest = components["schemas"]["pull-request"];

export const sourcebot_diff_schema = z.object({
    oldSnippet: z.string(),
    newSnippet: z.string(),
});
export type sourcebot_diff = z.infer<typeof sourcebot_diff_schema>;

export const sourcebot_file_diff_schema = z.object({
    from: z.string(),
    to: z.string(),
    diffs: z.array(sourcebot_diff_schema),
});
export type sourcebot_file_diff = z.infer<typeof sourcebot_file_diff_schema>;

export const sourcebot_pr_payload_schema = z.object({
    title: z.string(),
    description: z.string(),
    hostDomain: z.string(),
    owner: z.string(),
    repo: z.string(),
    file_diffs: z.array(sourcebot_file_diff_schema),
    number: z.number(),
    head_sha: z.string()
});
export type sourcebot_pr_payload = z.infer<typeof sourcebot_pr_payload_schema>;

export const sourcebot_context_schema = z.object({
    type: z.enum(["pr_title", "pr_description", "pr_summary", "comment_chains", "file_content"]),
    description: z.string().optional(),
    context: z.string(),
});
export type sourcebot_context = z.infer<typeof sourcebot_context_schema>;

export const sourcebot_diff_review_schema = z.object({
    line_start: z.number(),
    line_end: z.number(),
    review: z.string(),
});
export type sourcebot_diff_review = z.infer<typeof sourcebot_diff_review_schema>;

export const sourcebot_file_diff_review_schema = z.object({
    filename: z.string(),
    reviews: z.array(sourcebot_diff_review_schema),
});
export type sourcebot_file_diff_review = z.infer<typeof sourcebot_file_diff_review_schema>;

