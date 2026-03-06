
export type TextContent = { type: "text", text: string };

export type ListTreeEntry = {
    type: 'tree' | 'blob';
    path: string;
    name: string;
    parentPath: string;
    depth: number;
};

export type ListTreeApiNode = {
    type: 'tree' | 'blob';
    path: string;
    name: string;
    children: ListTreeApiNode[];
};