import globToRegexp from 'glob-to-regexp';
import escapeStringRegexp from 'escape-string-regexp';

// -------------------------------------------------------
// Playground for building Sourcebot/zoekt search queries
// from grep-style (pattern, path, include) inputs.
//
// Run with: yarn workspace @sourcebot/web tsx tools/globToRegexpPlayground.ts
// -------------------------------------------------------

interface SearchInput {
    pattern: string;       // content search term or regex
    path?: string;         // directory prefix, e.g. "packages/web/src"
    include?: string;      // glob for filenames, e.g. "*.ts" or "**/*.{ts,tsx}"
}

function globToFileRegexp(glob: string): string {
    const re = globToRegexp(glob, { extended: true, globstar: true });
    // Strip ^ anchor — Sourcebot file paths include the full repo-relative path,
    // so the pattern shouldn't be anchored to the start.
    return re.source.replace(/^\^/, '');
}

function buildRipgrepCommand({ pattern, path, include }: SearchInput): string {
    const parts = ['rg', `"${pattern.replace(/"/g, '\\"')}"`];
    if (path) parts.push(path);
    if (include) parts.push(`--glob "${include}"`);
    return parts.join(' ');
}

function buildZoektQuery({ pattern, path, include }: SearchInput): string {
    const parts: string[] = [`"${pattern.replace(/"/g, '\\"')}"`];

    if (path) {
        parts.push(`file:${escapeStringRegexp(path)}`);
    }

    if (include) {
        parts.push(`file:${globToFileRegexp(include)}`);
    }

    return parts.join(' ');
}

// -------------------------------------------------------
// Examples
// -------------------------------------------------------

const examples: SearchInput[] = [
    // Broad content search, no file scoping
    { pattern: 'isServiceError' },

    // Scoped to a directory
    { pattern: 'isServiceError', path: 'packages/web/src' },

    // Scoped to a file type
    { pattern: 'isServiceError', include: '*.ts' },

    // Scoped to both
    { pattern: 'isServiceError', path: 'packages/web/src', include: '*.ts' },

    // Multiple extensions via glob
    { pattern: 'useQuery', include: '**/*.{ts,tsx}' },

    // Test files only
    { pattern: 'expect\\(', include: '*.test.ts' },

    // Specific subdirectory + extension
    { pattern: 'withAuth', path: 'packages/web/src/app', include: '**/*.ts' },

    // Next.js route group — parens in path are regex special chars
    { pattern: 'withAuth', path: 'packages/web/src/app/api/(server)', include: '**/*.ts' },

    // Next.js dynamic segment — brackets in path are regex special chars
    { pattern: 'withOptionalAuth', path: 'packages/web/src/app/[domain]', include: '**/*.ts' },

    // Pattern with spaces — must be quoted in zoekt query
    { pattern: 'Starting scheduler', include: '**/*.ts' },

    // Literal phrase in a txt file
    { pattern: String.raw`"hello world"`, include: '**/*.txt' },

    // Pattern with a quote character
    { pattern: 'from "@/lib', include: '**/*.ts' },

    // Pattern with a backslash — needs double-escaping in zoekt quoted terms
    { pattern: String.raw`C:\\\\Windows\\\\System32`, include: '**/*.ts' },
];

function truncate(str: string, width: number): string {
    return str.length > width ? str.slice(0, width - 3) + '...' : str.padEnd(width);
}

const col1 = 70;
const col2 = 75;
console.log(truncate('input', col1) + truncate('ripgrep', col2) + 'zoekt query');
console.log('-'.repeat(col1 + col2 + 50));

function prettyPrint(example: SearchInput): string {
    const fields = Object.entries(example)
        .map(([k, v]) => `${k}: '${v}'`)
        .join(', ');
    return `{ ${fields} }`;
}

for (const example of examples) {
    const input = prettyPrint(example);
    const rg = buildRipgrepCommand(example);
    const zoekt = buildZoektQuery(example);
    console.log(truncate(input, col1) + rg.padEnd(col2) + zoekt);
}
