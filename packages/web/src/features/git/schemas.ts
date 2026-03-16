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
