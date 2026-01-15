import { expect, test } from 'vitest';
import { buildFileTree, isPathValid, normalizePath } from './utils';

test('normalizePath adds a trailing slash and strips leading slashes', () => {
    expect(normalizePath('/a/b')).toBe('a/b/');
});

test('normalizePath keeps an existing trailing slash', () => {
    expect(normalizePath('a/b/')).toBe('a/b/');
});

test('normalizePath returns empty string for root', () => {
    expect(normalizePath('/')).toBe('');
});

test('isPathValid rejects traversal and null bytes', () => {
    expect(isPathValid('a/../b')).toBe(false);
    expect(isPathValid('a/\0b')).toBe(false);
});

test('isPathValid allows normal paths', () => {
    expect(isPathValid('a/b')).toBe(true);
});

test('isPathValid allows paths with dots', () => {
    expect(isPathValid('a/b/c.txt')).toBe(true);
    expect(isPathValid('a/b/c...')).toBe(true);
    expect(isPathValid('a/b/c.../d')).toBe(true);
    expect(isPathValid('a/b/..c')).toBe(true);
    expect(isPathValid('a/b/[..path]')).toBe(true);
});

test('buildFileTree handles a empty flat list', () => {
    const flatList: { type: string, path: string }[] = [];
    const tree = buildFileTree(flatList);
    expect(tree).toMatchObject({
        name: 'root',
        type: 'tree',
        path: '',
    });
});

test('buildFileTree builds a sorted tree from a flat list', () => {
    const flatList: { type: string, path: string }[] = [
        { type: 'blob', path: 'a' },
        { type: 'tree', path: 'b' },
        { type: 'tree', path: 'b/c' },
        { type: 'tree', path: 'd' },
        { type: 'blob', path: 'd/e' }
    ];

    const tree = buildFileTree(flatList);

    expect(tree).toMatchObject({
        name: 'root',
        type: 'tree',
        path: '',
        children: [
            {
                name: 'b',
                type: 'tree',
                path: 'b',
                children: [
                    {
                        name: 'c',
                        type: 'tree',
                        path: 'b/c',
                        children: [],
                    },
                ],
            },
            {
                name: 'd',
                type: 'tree',
                path: 'd',
                children: [
                    {
                        name: 'e',
                        type: 'blob',
                        path: 'd/e',
                        children: [],
                    },
                ],
            },
            {
                name: 'a',
                type: 'blob',
                path: 'a',
                children: [],
            }
        ],
    });
});

