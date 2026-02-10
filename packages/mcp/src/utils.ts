import { ListTreeApiNode, ListTreeEntry, ServiceError } from "./types.js";


export const isServiceError = (data: unknown): data is ServiceError => {
    return typeof data === 'object' &&
        data !== null &&
        'statusCode' in data &&
        'errorCode' in data &&
        'message' in data;
}

export class ServiceErrorException extends Error {
    constructor(public readonly serviceError: ServiceError) {
        super(JSON.stringify(serviceError));
    }
}

export const normalizeTreePath = (path: string): string => {
    const withoutLeading = path.replace(/^\/+/, '');
    return withoutLeading.replace(/\/+$/, '');
}

export const joinTreePath = (parentPath: string, name: string): string => {
    if (!parentPath) {
        return name;
    }

    return `${parentPath}/${name}`;
}

export const buildTreeNodeIndex = (root: ListTreeApiNode): Map<string, ListTreeApiNode> => {
    const nodeIndex = new Map<string, ListTreeApiNode>();

    const visit = (node: ListTreeApiNode, currentPath: string) => {
        nodeIndex.set(currentPath, node);

        for (const child of node.children) {
            visit(child, joinTreePath(currentPath, child.name));
        }
    };

    visit(root, '');

    return nodeIndex;
}

export const sortTreeEntries = (entries: ListTreeEntry[]): ListTreeEntry[] => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

    return [...entries].sort((a, b) => {
        const parentCompare = collator.compare(a.parentPath, b.parentPath);
        if (parentCompare !== 0) {
            return parentCompare;
        }

        if (a.type !== b.type) {
            // sort directories above files
            return a.type === 'tree' ? -1 : 1;
        }

        const nameCompare = collator.compare(a.name, b.name);
        if (nameCompare !== 0) {
            return nameCompare;
        }

        return collator.compare(a.path, b.path);
    });
}
