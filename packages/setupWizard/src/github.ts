import { input, password } from '@inquirer/prompts';
import { tabCheckbox as checkbox } from './tabCheckbox.js';
import { select as searchSelect, Separator } from 'inquirer-select-pro';
import type { GithubConnectionConfig } from '@sourcebot/schemas/v3/github.type';
import type { CollectResult, EnvVars } from './utils.js';
import { createSearchSelectContext, INPUT_THEME, note, toEnvKey } from './utils.js';

function githubApiBase(url: string): string {
    try {
        const u = new URL(url);
        if (u.hostname === 'github.com') {
            return 'https://api.github.com';
        }
        return `${u.protocol}//${u.hostname}/api/v3`;
    } catch {
        return 'https://api.github.com';
    }
}

type SearchOption = { name: string; value: string };
type GitHubSearchType = 'org' | 'user' | 'repo';
const githubSearchCache = new Map<string, Array<SearchOption | Separator>>();
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

async function searchGitHub(
    apiBase: string,
    query: string,
    token: string,
    type: GitHubSearchType,
): Promise<Array<SearchOption | Separator>> {
    const cacheKey = `${apiBase}|${type}|${query}`;
    const cached = githubSearchCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const headers: Record<string, string> = {
        'User-Agent': 'setup-sourcebot',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const url = type === 'repo'
        ? `${apiBase}/search/repositories?q=${encodeURIComponent(query)}&per_page=8`
        : `${apiBase}/search/users?q=${encodeURIComponent(query)}+type:${type}&per_page=8`;
    const res = await fetch(url, { headers });
    const data = await res.json() as { items?: Array<{ login?: string; full_name?: string }> };

    const literalFallback = (): SearchOption | null => {
        return { name: query, value: query };
    };

    if (!res.ok) {
        const warning =
            (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')
                ? '⚠ Autocomplete disabled — GitHub rate limit exceeded.'
                : '⚠ Autocomplete disabled — authentication failed, check your PAT.';
        const fallback = literalFallback();
        return fallback ? [fallback, new Separator(warning)] : [new Separator(warning)];
    }

    const results: SearchOption[] = (data.items ?? []).map((item) => {
        const value = type === 'repo' ? item.full_name! : item.login!;
        return { name: value, value };
    });
    if (results.length === 0) {
        const fallback = literalFallback();
        return fallback ? [fallback] : [];
    }
    githubSearchCache.set(cacheKey, results);
    return results;
}

export async function collectGitHubConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};
    const config: GithubConnectionConfig = { type: 'github' };

    const url = await input({
        message: 'GitHub URL',
        default: 'https://github.com',
        theme: INPUT_THEME,
        validate: (v) => {
            if (!v?.trim()) {
                return 'URL is required';
            }
            if (!/^https?:\/\//.test(v)) {
                return 'Must start with http:// or https://';
            }
            return true;
        },
    });
    if (url !== 'https://github.com') {
        config.url = url;
    }

    note(
        [
            'Fine-grained PAT (recommended):',
            `  ${url}/settings/personal-access-tokens/new`,
            '  Required permissions: Contents (read), Metadata (read)',
            '',
            'Classic PAT:',
            `  ${url}/settings/tokens/new`,
            '  Required scope: repo',
        ].join('\n'),
        'Create a GitHub Personal Access Token',
    );

    const tokenEnvKey = toEnvKey(connectionName, 'TOKEN');
    const token = await password({
        message: `GitHub Personal Access Token (stored locally in .env as ${tokenEnvKey}, leave blank for public repos only)`,
        mask: true,
    });
    if (token.trim()) {
        env[tokenEnvKey] = token;
        config.token = { env: tokenEnvKey };
    }

    const apiBase = githubApiBase(url);

    const targets = await checkbox<string>({
        message: 'What do you want to index?',
        choices: [
            { value: 'repos', name: 'Specific repositories', description: 'Hand-pick individual repos to index' },
            { value: 'orgs', name: 'Organizations', description: 'Index every repo each chosen org owns' },
            { value: 'users', name: 'Users', description: 'Index every repo each chosen user owns' },
        ],
        required: true,
    });

    if (targets.includes('repos')) {
        const ctx = createSearchSelectContext();
        const repos = await searchSelect<string, true>({
            message: 'Repositories to index (type to search, or type owner/repo)',
            multiple: true,
            required: true,
            loop: false,
            clearInputWhenSelected: true,
            theme: ctx.theme,
            placeholder: 'Type to search...',
            options: async (search) => {
                ctx.trackSearch(search);
                if (!search) {
                    return [];
                }
                ctx.setLoading(true);
                try {
                    return await searchGitHub(apiBase, search, token, 'repo');
                } finally {
                    ctx.setLoading(false);
                }
            },
            validate: (selected) => {
                for (const opt of selected) {
                    if (!REPO_PATTERN.test(opt.value)) {
                        return `Invalid format: "${opt.value}" — expected owner/repo`;
                    }
                }
                return true;
            },
        });
        config.repos = repos;
    }

    if (targets.includes('orgs')) {
        const ctx = createSearchSelectContext();
        const orgs = await searchSelect<string, true>({
            message: 'Organizations to index (type to search)',
            multiple: true,
            required: true,
            loop: false,
            clearInputWhenSelected: true,
            theme: ctx.theme,
            placeholder: 'Type to search...',
            options: async (search) => {
                ctx.trackSearch(search);
                if (!search) {
                    return [];
                }
                ctx.setLoading(true);
                try {
                    return await searchGitHub(apiBase, search, token, 'org');
                } finally {
                    ctx.setLoading(false);
                }
            },
        });
        config.orgs = orgs;
    }

    if (targets.includes('users')) {
        const ctx = createSearchSelectContext();
        const users = await searchSelect<string, true>({
            message: 'GitHub users to index (type to search)',
            multiple: true,
            required: true,
            loop: false,
            clearInputWhenSelected: true,
            theme: ctx.theme,
            placeholder: 'Type to search...',
            options: async (search) => {
                ctx.trackSearch(search);
                if (!search) {
                    return [];
                }
                ctx.setLoading(true);
                try {
                    return await searchGitHub(apiBase, search, token, 'user');
                } finally {
                    ctx.setLoading(false);
                }
            },
        });
        config.users = users;
    }

    return { connections: [{ config }], env };
}
