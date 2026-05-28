import { input, password } from '@inquirer/prompts';
import { tabCheckbox as checkbox } from './tabCheckbox.js';
import { select as searchSelect, Separator } from 'inquirer-select-pro';
import type { GitlabConnectionConfig } from '@sourcebot/schemas/v3/gitlab.type';
import type { CollectResult, EnvVars } from './utils.js';
import { createSearchSelectContext, INPUT_THEME, note, toEnvKey } from './utils.js';

function gitlabApiBase(url: string): string {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}/api/v4`;
    } catch {
        return 'https://gitlab.com/api/v4';
    }
}

type SearchOption = { name: string; value: string };
type GitLabSearchType = 'group' | 'project' | 'user';
const gitlabSearchCache = new Map<string, Array<SearchOption | Separator>>();
const PROJECT_PATTERN = /^[\w.-]+(\/[\w.-]+)+$/;

async function searchGitLab(
    apiBase: string,
    query: string,
    token: string,
    type: GitLabSearchType,
): Promise<Array<SearchOption | Separator>> {
    const cacheKey = `${apiBase}|${type}|${query}`;
    const cached = gitlabSearchCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const headers: Record<string, string> = {
        'User-Agent': 'setup-sourcebot',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const endpoint = type === 'group' ? 'groups' : type === 'project' ? 'projects' : 'users';
    const extraParams = type === 'project' ? '&simple=true' : '';
    const url = `${apiBase}/${endpoint}?search=${encodeURIComponent(query)}&per_page=8${extraParams}`;
    const res = await fetch(url, { headers });

    const literalFallback = (): SearchOption | null => {
        if (type === 'project') {
            return PROJECT_PATTERN.test(query) ? { name: query, value: query } : null;
        }
        return { name: query, value: query };
    };

    if (!res.ok) {
        const warning = res.status === 401
            ? '⚠ Autocomplete disabled — authentication failed, check your PAT.'
            : `⚠ Autocomplete disabled — GitLab API error (${res.status}).`;
        const fallback = literalFallback();
        return fallback ? [fallback, new Separator(warning)] : [new Separator(warning)];
    }

    const data = await res.json() as Array<{
        full_path?: string;
        path_with_namespace?: string;
        username?: string;
    }>;

    const results: SearchOption[] = data.map((item) => {
        let value: string;
        if (type === 'group') {
            value = item.full_path!;
        } else if (type === 'project') {
            value = item.path_with_namespace!;
        } else {
            value = item.username!;
        }
        return { name: value, value };
    });

    if (results.length === 0) {
        const fallback = literalFallback();
        return fallback ? [fallback] : [];
    }

    gitlabSearchCache.set(cacheKey, results);
    return results;
}

export async function collectGitLabConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};
    const config: GitlabConnectionConfig = { type: 'gitlab' };

    const url = await input({
        message: 'GitLab URL',
        default: 'https://gitlab.com',
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
    if (url !== 'https://gitlab.com') {
        config.url = url;
    }

    note(
        [
            'Create a PAT:',
            `  ${url}/-/user_settings/personal_access_tokens`,
            '  Required scope: read_api',
        ].join('\n'),
        'Create a GitLab Personal Access Token',
    );

    const gitlabEnvKey = toEnvKey(connectionName, 'TOKEN');
    const gitlabToken = await password({
        message: `GitLab Personal Access Token (stored locally in .env as ${gitlabEnvKey}, leave blank for public repos only)`,
        mask: true,
    });
    if (gitlabToken.trim()) {
        env[gitlabEnvKey] = gitlabToken;
        config.token = { env: gitlabEnvKey };
    }

    const apiBase = gitlabApiBase(url);
    const isSelfHosted = url !== 'https://gitlab.com';

    const targets = await checkbox<string>({
        message: 'What do you want to index?',
        choices: [
            ...(isSelfHosted
                ? [{ value: 'all', name: 'Everything', description: 'Index every project visible to the token on this self-hosted instance' }]
                : []),
            { value: 'groups', name: 'Groups', description: 'Index every project each chosen group owns' },
            { value: 'projects', name: 'Specific projects', description: 'Hand-pick individual projects to index' },
            { value: 'users', name: 'Users', description: 'Index every project each chosen user owns' },
        ],
        required: true,
    });

    if (targets.includes('all')) {
        config.all = true;
    }

    if (targets.includes('groups')) {
        const ctx = createSearchSelectContext();
        const groups = await searchSelect<string, true>({
            message: 'Groups to index (type to search)',
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
                    return await searchGitLab(apiBase, search, gitlabToken, 'group');
                } finally {
                    ctx.setLoading(false);
                }
            },
        });
        config.groups = groups;
    }

    if (targets.includes('projects')) {
        const ctx = createSearchSelectContext();
        const projects = await searchSelect<string, true>({
            message: 'Projects to index (type to search, or type group/project)',
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
                    return await searchGitLab(apiBase, search, gitlabToken, 'project');
                } finally {
                    ctx.setLoading(false);
                }
            },
            validate: (selected) => {
                for (const opt of selected) {
                    if (!PROJECT_PATTERN.test(opt.value)) {
                        return `Invalid format: "${opt.value}" — expected group/project`;
                    }
                }
                return true;
            },
        });
        config.projects = projects;
    }

    if (targets.includes('users')) {
        const ctx = createSearchSelectContext();
        const users = await searchSelect<string, true>({
            message: 'Users to index (type to search)',
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
                    return await searchGitLab(apiBase, search, gitlabToken, 'user');
                } finally {
                    ctx.setLoading(false);
                }
            },
        });
        config.users = users;
    }

    return { connections: [{ config }], env };
}
