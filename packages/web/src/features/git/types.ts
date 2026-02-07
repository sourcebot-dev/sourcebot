import z from "zod";

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
