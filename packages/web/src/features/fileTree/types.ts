import { z } from "zod";

export const getTreeRequestSchema = z.object({
    repoName: z.string(),
    revisionName: z.string(),
    path: z.string(),
});
export type GetTreeRequest = z.infer<typeof getTreeRequestSchema>;

export const getFilesRequestSchema = z.object({
    repoName: z.string(),
    revisionName: z.string(),
});
export type GetFilesRequest = z.infer<typeof getFilesRequestSchema>;

export const getFolderContentsRequestSchema = z.object({
    repoName: z.string(),
    revisionName: z.string(),
    path: z.string(),
});
export type GetFolderContentsRequest = z.infer<typeof getFolderContentsRequestSchema>;

export const fileTreeItemSchema = z.object({
    type: z.string(),
    path: z.string(),
    name: z.string(),
});
export type FileTreeItem = z.infer<typeof fileTreeItemSchema>;

type FileTreeNodeType = {
    type: string;
    path: string;
    name: string;
    children: FileTreeNodeType[];
};

export const fileTreeNodeSchema: z.ZodType<FileTreeNodeType> = z.lazy(() => z.object({
    type: z.string(),
    path: z.string(),
    name: z.string(),
    children: z.array(fileTreeNodeSchema),
}));
export type FileTreeNode = z.infer<typeof fileTreeNodeSchema>;

export const getTreeResponseSchema = z.object({
    tree: fileTreeNodeSchema,
});
export type GetTreeResponse = z.infer<typeof getTreeResponseSchema>;

export const getFilesResponseSchema = z.array(fileTreeItemSchema);
export type GetFilesResponse = z.infer<typeof getFilesResponseSchema>;

export const getFolderContentsResponseSchema = z.array(fileTreeItemSchema);
export type GetFolderContentsResponse = z.infer<typeof getFolderContentsResponseSchema>;

