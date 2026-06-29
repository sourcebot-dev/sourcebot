// Best-effort linguist language name for an attachment filename, used to drive
// CodeMirror syntax highlighting when rendering an attachment as evidence.
// Unmapped extensions resolve to '' (plain text) via getCodemirrorLanguage.
const EXTENSION_TO_LINGUIST_LANGUAGE: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', mts: 'TypeScript', cts: 'TypeScript',
    js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
    py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java',
    kt: 'Kotlin', kts: 'Kotlin', c: 'C', h: 'C', cpp: 'C++', cc: 'C++',
    hpp: 'C++', cs: 'C#', php: 'PHP', swift: 'Swift', scala: 'Scala',
    sh: 'Shell', bash: 'Shell', zsh: 'Shell', sql: 'SQL',
    graphql: 'GraphQL', gql: 'GraphQL', proto: 'Protocol Buffer',
    lua: 'Lua', r: 'R', pl: 'Perl', dart: 'Dart', vue: 'Vue',
    svelte: 'Svelte', json: 'JSON', jsonl: 'JSON', yaml: 'YAML', yml: 'YAML',
    toml: 'TOML', xml: 'XML', html: 'HTML', css: 'CSS', scss: 'SCSS',
    md: 'Markdown', markdown: 'Markdown',
};

export const getLinguistLanguageForFilename = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower === 'dockerfile') {
        return 'Dockerfile';
    }
    const parts = lower.split('.');
    const extension = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
    return EXTENSION_TO_LINGUIST_LANGUAGE[extension] ?? '';
};
