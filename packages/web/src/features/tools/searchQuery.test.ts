import { describe, expect, it } from 'vitest';
import { buildGlobSearchQuery, buildGrepSearchQuery } from './searchQuery';

describe('buildGrepSearchQuery', () => {
    it('preserves spaces and quotes in structured search inputs', () => {
        const query = buildGrepSearchQuery({
            pattern: 'call("hello world")',
            path: 'src/my dir',
            include: 'My Tests/**/*.test.ts',
            repo: 'Acme, Platform',
            ref: 'feature/my feature',
        });

        expect(query).toEqual({
            and: {
                children: [
                    {
                        regexp: {
                            regexp: 'call("hello world")',
                            case_sensitive: true,
                            file_name: false,
                            content: true,
                        },
                        query: 'regexp',
                    },
                    {
                        regexp: {
                            regexp: 'src/my dir',
                            case_sensitive: true,
                            file_name: true,
                            content: false,
                        },
                        query: 'regexp',
                    },
                    {
                        regexp: {
                            regexp: 'My Tests\\/((?:[^/]*(?:\\/|$))*)([^/]*)\\.test\\.ts$',
                            case_sensitive: true,
                            file_name: true,
                            content: false,
                        },
                        query: 'regexp',
                    },
                    {
                        repo_set: {
                            set: { 'Acme, Platform': true },
                        },
                        query: 'repo_set',
                    },
                    {
                        branch: {
                            pattern: 'feature/my feature',
                            exact: false,
                        },
                        query: 'branch',
                    },
                ],
            },
            query: 'and',
        });
    });

    it('uses exact selected repository names when no explicit repo is provided', () => {
        const query = buildGrepSearchQuery({
            pattern: 'needle',
            selectedRepos: ['Repo, One', 'Repo Two'],
        });

        expect(query).toMatchObject({
            and: {
                children: [
                    { regexp: { regexp: 'needle' } },
                    {
                        repo_set: {
                            set: {
                                'Repo, One': true,
                                'Repo Two': true,
                            },
                        },
                    },
                ],
            },
        });
    });

    it('keeps a bare content search as a single IR node', () => {
        expect(buildGrepSearchQuery({ pattern: 'needle' })).toEqual({
            regexp: {
                regexp: 'needle',
                case_sensitive: true,
                file_name: false,
                content: true,
            },
            query: 'regexp',
        });
    });
});

describe('buildGlobSearchQuery', () => {
    it('keeps a glob containing spaces in one file predicate', () => {
        const query = buildGlobSearchQuery({
            pattern: 'My Folder/**/*.ts',
            path: 'packages/my-dir/[legacy] (copy)+',
        });

        expect(query).toEqual({
            and: {
                children: [
                    {
                        regexp: {
                            regexp: 'My Folder\\/((?:[^/]*(?:\\/|$))*)([^/]*)\\.ts$',
                            case_sensitive: true,
                            file_name: true,
                            content: false,
                        },
                        query: 'regexp',
                    },
                    {
                        regexp: {
                            regexp: 'packages/my-dir/\\[legacy\\] \\(copy\\)\\+',
                            case_sensitive: true,
                            file_name: true,
                            content: false,
                        },
                        query: 'regexp',
                    },
                ],
            },
            query: 'and',
        });
    });

    it('preserves the rev:* behavior for searching every branch', () => {
        const query = buildGlobSearchQuery({
            pattern: '*.ts',
            ref: '*',
        });

        expect(query).toMatchObject({
            and: {
                children: [
                    { regexp: { file_name: true } },
                    { branch: { pattern: '', exact: false } },
                ],
            },
        });
    });
});
