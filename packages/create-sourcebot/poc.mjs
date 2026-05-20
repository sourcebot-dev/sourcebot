import { password } from '@inquirer/prompts';
import { select, Separator } from 'inquirer-select-pro';
import { appendFileSync } from 'fs';

function dbg(msg) {
    appendFileSync('/tmp/poc-debug.log', msg + '\n');
}

const cache = new Map();
let abortController = null;

async function searchGitHubOrgs(query, token, signal) {
    if (cache.has(query)) {
        dbg(`cache hit: "${query}"`);
        return cache.get(query);
    }
    dbg(`searching: "${query}"`);
    const headers = {
        'User-Agent': 'create-sourcebot',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const url = `https://api.github.com/search/users?q=${encodeURIComponent(query)}+type:org&per_page=8`;
    const res = await fetch(url, { headers, signal });
    dbg(`status: ${res.status}`);
    const data = await res.json();
    dbg(`response: ${JSON.stringify(data).slice(0, 300)}`);

    if (!res.ok) {
        const warning =
            (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') ?
                '⚠ Autocomplete disabled - GitHub rate limit exceeded.' :
                '⚠ Autocomplete disalbed - Authentication failed, check your PAT.';
        return [
            { name: query, value: query },
            new Separator(warning),
        ];
    }

    const results = data.items.map(item => ({ name: item.login, value: item.login }));
    if (results.length === 0) {
        return [{ name: query, value: query }];
    }
    cache.set(query, results);
    return results;
}

const token = await password({
    message: 'GitHub PAT (leave blank for public search)',
    mask: true,
});

const orgs = await select({
    message: 'Search for GitHub organizations to index',
    multiple: true,
    loop: false,
    clearInputWhenSelected: true,
    options: async (input) => {
        if (!input || input.length < 2) {
            return [];
        }
        return searchGitHubOrgs(input, token);
    },
});

console.log(`\nSelected: ${orgs.join(', ')}`);
