import { FileTreeNode } from "./types";

export const normalizePath = (path: string): string => {
    // Normalize the path by...
    let normalizedPath = path;

    // ... adding a trailing slash if it doesn't have one.
    // This is important since ls-tree won't return the contents
    // of a directory if it doesn't have a trailing slash.
    if (!normalizedPath.endsWith('/')) {
        normalizedPath = `${normalizedPath}/`;
    }

    // ... removing any leading slashes. This is needed since
    // the path is relative to the repository's root, so we
    // need a relative path.
    if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.slice(1);
    }

    return normalizedPath;
}

// @note: we don't allow directory traversal
// or null bytes in the path.
export const isPathValid = (path: string) => {
    return !path.includes('..') && !path.includes('\0');
}

export const getPathspecs = (path: string): string[] => {
    const normalizedPath = normalizePath(path);
    if (normalizedPath.length === 0) {
        return [];
    }

    const parts = normalizedPath.split('/').filter((part: string) => part.length > 0);
    const pathspecs: string[] = [];

    for (let i = 0; i < parts.length; i++) {
        const prefix = parts.slice(0, i + 1).join('/');
        pathspecs.push(`${prefix}/`);
    }

    return pathspecs;
}


export const buildFileTree = (flatList: { type: string, path: string }[]): FileTreeNode => {
    const root: FileTreeNode = {
        name: 'root',
        path: '',
        type: 'tree',
        children: [],
    };

    for (const item of flatList) {
        const parts = item.path.split('/');
        let current: FileTreeNode = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLeaf = i === parts.length - 1;
            const nodeType = isLeaf ? item.type : 'tree';
            let next = current.children.find((child: FileTreeNode) => child.name === part && child.type === nodeType);

            if (!next) {
                next = {
                    name: part,
                    path: item.path,
                    type: nodeType,
                    children: [],
                };
                current.children.push(next);
            }
            current = next;
        }
    }

    const sortTree = (node: FileTreeNode): FileTreeNode => {
        if (node.type === 'blob') {
            return node;
        }

        const sortedChildren = node.children
            .map(sortTree)
            .sort((a: FileTreeNode, b: FileTreeNode) => {
                if (a.type !== b.type) {
                    return a.type === 'tree' ? -1 : 1;
                }
                return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            });

        return {
            ...node,
            children: sortedChildren,
        };
    };

    return sortTree(root);
}
