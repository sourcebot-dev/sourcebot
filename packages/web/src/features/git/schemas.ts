import { CodeHostType } from '@sourcebot/db';
import z from 'zod';
import { fileTreeItemSchema, fileTreeNodeSchema } from './types';

export const getTreeRequestSchema = z.object({
    repoName: z.string(),
    revisionName: z.string(),
    paths: z.array(z.string()),
});

export const getTreeResponseSchema = z.object({
    tree: fileTreeNodeSchema,
});

export const getFilesRequestSchema = z.object({
    repoName: z.string(),
    revisionName: z.string(),
});

export const getFilesResponseSchema = z.array(fileTreeItemSchema);

export const fileSourceRequestSchema = z.object({
    path: z.string(),
    repo: z.string(),
    ref: z.string().optional(),
});

export const fileSourceResponseSchema = z.object({
    source: z.string(),
    language: z.string(),
    path: z.string(),
    repo: z.string(),
    repoCodeHostType: z.nativeEnum(CodeHostType),
    repoDisplayName: z.string().optional(),
    repoExternalWebUrl: z.string().optional(),
    webUrl: z.string(),
    externalWebUrl: z.string().optional(),
});

export const getDiffRequestSchema = z.object({
    repo: z.string().describe('The fully-qualified repository name.'),
    base: z.string().describe('The base git ref (branch, tag, or commit SHA) to diff from.'),
    head: z.string().describe('The head git ref (branch, tag, or commit SHA) to diff to.'),
});

const hunkRangeSchema = z.object({
    start: z.number().int().describe('The 1-based line number where the range starts.'),
    lines: z.number().int().describe('The number of lines the range spans.'),
});

const diffHunkSchema = z.object({
    oldRange: hunkRangeSchema.describe('The line range in the old file.'),
    newRange: hunkRangeSchema.describe('The line range in the new file.'),
    heading: z.string().optional().describe('Optional context heading extracted from the @@ line, typically the enclosing function or class name.'),
    body: z.string().describe('The diff content, with each line prefixed by a space (context), + (addition), or - (deletion).'),
});

const fileDiffSchema = z.object({
    oldPath: z.string().describe('The file path before the change. `/dev/null` for added files.'),
    newPath: z.string().describe('The file path after the change. `/dev/null` for deleted files.'),
    hunks: z.array(diffHunkSchema).describe('The list of changed regions within the file.'),
});

export const getDiffResponseSchema = z.object({
    files: z.array(fileDiffSchema).describe('The list of changed files.'),
});
