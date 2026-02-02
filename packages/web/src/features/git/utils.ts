import { createLogger } from '@sourcebot/shared';
import { FileTreeItem, FileTreeNode } from "./types";

export const logger = createLogger('git');

// @note: we don't allow directory traversal
// or null bytes in the path.
export const isPathValid = (path: string) => {
    const pathSegments = path.split('/');
    if (pathSegments.some(segment => segment === '..') || path.includes('\0')) {
        return false;
    }

    return true;
}

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

export const compareFileTreeItems = (a: FileTreeItem, b: FileTreeItem): number => {
    if (a.type !== b.type) {
        return a.type === 'tree' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
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
            .sort(compareFileTreeItems);

        return {
            ...node,
            children: sortedChildren,
        };
    };

    return sortTree(root);
}