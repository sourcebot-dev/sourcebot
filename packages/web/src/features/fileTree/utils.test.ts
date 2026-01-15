import { expect, test } from 'vitest';
import { buildFileTree, normalizePath } from './utils';

test('normalizePath adds a trailing slash and strips leading slashes', () => {
    expect(normalizePath('/a/b')).toBe('a/b/');
});

test('normalizePath keeps an existing trailing slash', () => {
    expect(normalizePath('a/b/')).toBe('a/b/');
});

test('normalizePath returns empty string for root', () => {
    expect(normalizePath('/')).toBe('');
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

