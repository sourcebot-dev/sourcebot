
export type TextContent = { type: "text", text: string };

export type { ListTreeEntry } from "@/features/tools/listTree";

export type ListTreeApiNode = {
    type: 'tree' | 'blob';
    path: string;
    name: string;
    children: ListTreeApiNode[];
};