import { describe, it, expect } from 'vitest';
import { getBrowseParamsFromPathParam } from './utils';

describe('getBrowseParamsFromPathParam', () => {
    describe('tree paths', () => {
        it('should parse tree path with trailing slash', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/tree/');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'HEAD',
                path: '',
                pathType: 'tree',
            });
        });

        it('should parse tree path without trailing slash', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/tree');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'HEAD',
                path: '',
                pathType: 'tree',
            });
        });

        it('should parse tree path with nested directory', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/tree/packages/web/src');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'HEAD',
                path: 'packages/web/src',
                pathType: 'tree',
            });
        });

        it('should parse tree path without revision', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt/-/tree/docs');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: undefined,
                path: 'docs',
                pathType: 'tree',
            });
        });
    });

    describe('blob paths', () => {


        it('should parse blob path with file', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/blob/README.md');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'HEAD',
                path: 'README.md',
                pathType: 'blob',
            });
        });

        it('should parse blob path with nested file', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/blob/packages/web/src/app/page.tsx');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'HEAD',
                path: 'packages/web/src/app/page.tsx',
                pathType: 'blob',
            });
        });

        it('should parse blob path without revision', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt/-/blob/main.go');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: undefined,
                path: 'main.go',
                pathType: 'blob',
            });
        });
    });

    describe('URL decoding', () => {
        it('should decode URL-encoded spaces in path', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/tree/folder%20with%20spaces');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'HEAD',
                path: 'folder with spaces',
                pathType: 'tree',
            });
        });

        it('should decode URL-encoded special characters in path', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/blob/file%20with%20%26%20symbols.txt');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'HEAD',
                path: 'file with & symbols.txt',
                pathType: 'blob',
            });
        });

        it('should decode paths with percent symbols in path', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/blob/%25hello%25%2Fworld.c');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'HEAD',
                path: '%hello%/world.c',
                pathType: 'blob',
            });
        });

        it('should decode paths with @ symbol encoded', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt%40HEAD/-/blob/file.txt');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'HEAD',
                path: 'file.txt',
                pathType: 'blob',
            });
        })
    });

    describe('different revision formats', () => {
        it('should parse with branch name', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@main/-/tree/');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'main',
                path: '',
                pathType: 'tree',
            });
        });

        it('should parse with commit hash', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@a1b2c3d/-/tree/');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'a1b2c3d',
                path: '',
                pathType: 'tree',
            });
        });

        it('should parse with tag', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@v1.0.0/-/tree/');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'v1.0.0',
                path: '',
                pathType: 'tree',
            });
        });
    });

    describe('edge cases', () => {
        it('should handle repo name with multiple @ symbols', () => {
            const result = getBrowseParamsFromPathParam('gitlab.com/user@domain/repo@main/-/tree/');
            expect(result).toEqual({
                repoName: 'gitlab.com/user@domain/repo',
                revisionName: 'main',
                path: '',
                pathType: 'tree',
            });
        });

        it('should handle paths with @ symbols', () => {
            const result = getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/blob/file@v1.0.0.txt');
            expect(result).toEqual({
                repoName: 'github.com/sourcebot-dev/zoekt',
                revisionName: 'HEAD',
                path: 'file@v1.0.0.txt',
                pathType: 'blob',
            });
        });
    });

    describe('error cases', () => {
        it('should throw error for blob path with trailing slash and no path', () => {
            expect(() => {
                getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/blob/');
            }).toThrow();
        });

        it('should throw error for blob path without trailing slash and no path', () => {
            expect(() => {
                getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/blob');
            }).toThrow();
        });

        it('should throw error for invalid pattern - missing /-/', () => {
            expect(() => {
                getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/tree/');
            }).toThrow();
        });

        it('should throw error for invalid pattern - missing tree/blob', () => {
            expect(() => {
                getBrowseParamsFromPathParam('github.com/sourcebot-dev/zoekt@HEAD/-/invalid/');
            }).toThrow();
        });

        it('should throw error for completely invalid format', () => {
            expect(() => {
                getBrowseParamsFromPathParam('invalid-path');
            }).toThrow();
        });

        it('should throw error for empty string', () => {
            expect(() => {
                getBrowseParamsFromPathParam('');
            }).toThrow();
        });
    });
}); 