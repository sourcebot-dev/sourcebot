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

export const sourcebot_diff_refs_schema = z.object({
    base_sha: z.string(),
    head_sha: z.string(),
    start_sha: z.string(),
});
export type sourcebot_diff_refs = z.infer<typeof sourcebot_diff_refs_schema>;

export const sourcebot_pr_payload_schema = z.object({
    title: z.string(),
    description: z.string(),
    hostDomain: z.string(),
    owner: z.string(),
    repo: z.string(),
    file_diffs: z.array(sourcebot_file_diff_schema),
    number: z.number(),
    head_sha: z.string(),
    diff_refs: sourcebot_diff_refs_schema.optional(),
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

const gitLabProjectSchema = z.object({
    id: z.number(),
    name: z.string(),
    path_with_namespace: z.string(),
    web_url: z.string(),
    namespace: z.string(),
});

const gitLabDiffRefsSchema = z.object({
    base_sha: z.string(),
    head_sha: z.string(),
    start_sha: z.string(),
}).nullable().optional();

export const gitLabMergeRequestPayloadSchema = z.object({
    object_kind: z.string(),
    object_attributes: z.object({
        iid: z.number(),
        title: z.string(),
        description: z.string().nullable(),
        action: z.string(),
        last_commit: z.object({ id: z.string() }),
        diff_refs: gitLabDiffRefsSchema,
    }),
    project: gitLabProjectSchema,
});
export type GitLabMergeRequestPayload = z.infer<typeof gitLabMergeRequestPayloadSchema>;

export const gitLabNotePayloadSchema = z.object({
    object_kind: z.string(),
    object_attributes: z.object({
        note: z.string(),
        noteable_type: z.string(),
    }),
    merge_request: z.object({
        iid: z.number(),
        title: z.string(),
        description: z.string().nullable(),
        last_commit: z.object({ id: z.string() }),
        diff_refs: gitLabDiffRefsSchema,
    }),
    project: gitLabProjectSchema,
});
export type GitLabNotePayload = z.infer<typeof gitLabNotePayloadSchema>;

