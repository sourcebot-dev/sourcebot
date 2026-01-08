import 'server-only';
import { fileNotFound, notFound, ServiceError } from "../../lib/serviceError";
import { FileSourceRequest, FileSourceResponse } from "./types";
import { getCodeHostBrowseFileAtBranchUrl } from "../../lib/utils";
import { sew } from "@/actions";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { Repo } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import path from 'path';
import { simpleGit } from 'simple-git';

/**
 * Retrieves the file source (content) for a given file in a repository.
 * 
 * This function uses `git show` to fetch file contents directly from the git repository,
 * which is more reliable than using zoekt search (which requires shards to be loaded).
 */
export const getFileSource = async ({ fileName, repository, branch }: FileSourceRequest): Promise<FileSourceResponse | ServiceError> => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        // Query the database to get the repository record
        const repo = await prisma.repo.findFirst({
            where: {
                name: repository,
                orgId: org.id,
            },
        });

        if (!repo) {
            return notFound();
        }

        const { path: repoPath } = getRepoPath(repo);
        const revisionName = branch ?? 'HEAD';

        // Use git show to fetch file contents
        const git = simpleGit().cwd(repoPath);

        let source: string;
        try {
            // git show <revision>:<path> returns the file content at the given revision
            source = await git.show([`${revisionName}:${fileName}`]);
        } catch (_error) {
            // If the file doesn't exist at this revision, git show will throw an error
            return fileNotFound(fileName, repository);
        }

        // Determine the language from the file extension
        const language = getLanguageFromFileName(fileName);

        // Construct the web URL for viewing this file on the code host
        const webUrl = getCodeHostBrowseFileAtBranchUrl({
            webUrl: repo.webUrl,
            codeHostType: repo.external_codeHostType,
            branchName: revisionName,
            filePath: fileName,
        });

        return {
            source,
            language,
            path: fileName,
            repository,
            repositoryCodeHostType: repo.external_codeHostType,
            repositoryDisplayName: repo.displayName ?? undefined,
            repositoryWebUrl: repo.webUrl ?? undefined,
            branch,
            webUrl,
        } satisfies FileSourceResponse;
    }));

/**
 * Returns the path to the git repository on disk.
 * 
 * @note: This is duplicated from the `getRepoPath` function in the
 * backend's `utils.ts` file and `fileTree/api.ts`. Eventually we should
 * move this to a shared package.
 */
const getRepoPath = (repo: Repo): { path: string, isReadOnly: boolean } => {
    // If we are dealing with a local repository, then use that as the path.
    // Mark as read-only since we aren't guaranteed to have write access to the local filesystem.
    const cloneUrl = new URL(repo.cloneUrl);
    if (repo.external_codeHostType === 'genericGitHost' && cloneUrl.protocol === 'file:') {
        return {
            path: cloneUrl.pathname,
            isReadOnly: true,
        }
    }

    const reposPath = path.join(env.DATA_CACHE_DIR, 'repos');

    return {
        path: path.join(reposPath, repo.id.toString()),
        isReadOnly: false,
    }
}

/**
 * Mapping of file extensions to GitHub Linguist language names.
 * This is used for syntax highlighting in the UI.
 * 
 * @see https://github.com/github-linguist/linguist/blob/main/lib/linguist/languages.yml
 */
const extensionToLanguageMap: Record<string, string> = {
    // JavaScript/TypeScript
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TSX',
    '.mjs': 'JavaScript',
    '.cjs': 'JavaScript',
    '.mts': 'TypeScript',
    '.cts': 'TypeScript',

    // Web
    '.html': 'HTML',
    '.htm': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'Sass',
    '.less': 'Less',
    '.vue': 'Vue',
    '.svelte': 'Svelte',

    // Python
    '.py': 'Python',
    '.pyw': 'Python',
    '.pyx': 'Cython',
    '.pxd': 'Cython',

    // Java/JVM
    '.java': 'Java',
    '.kt': 'Kotlin',
    '.kts': 'Kotlin',
    '.scala': 'Scala',
    '.groovy': 'Groovy',
    '.gradle': 'Gradle',
    '.clj': 'Clojure',
    '.cljs': 'Clojure',

    // C/C++
    '.c': 'C',
    '.h': 'C',
    '.cpp': 'C++',
    '.cc': 'C++',
    '.cxx': 'C++',
    '.hpp': 'C++',
    '.hxx': 'C++',
    '.hh': 'C++',

    // C#/F#
    '.cs': 'C#',
    '.fs': 'F#',
    '.fsx': 'F#',

    // Go
    '.go': 'Go',
    '.mod': 'Go Module',

    // Rust
    '.rs': 'Rust',

    // Ruby
    '.rb': 'Ruby',
    '.erb': 'HTML+ERB',
    '.rake': 'Ruby',
    '.gemspec': 'Ruby',

    // PHP
    '.php': 'PHP',
    '.phtml': 'PHP',

    // Swift/Objective-C
    '.swift': 'Swift',
    '.m': 'Objective-C',
    '.mm': 'Objective-C++',

    // Shell
    '.sh': 'Shell',
    '.bash': 'Shell',
    '.zsh': 'Shell',
    '.fish': 'fish',
    '.ps1': 'PowerShell',
    '.psm1': 'PowerShell',
    '.bat': 'Batchfile',
    '.cmd': 'Batchfile',

    // Data/Config
    '.json': 'JSON',
    '.jsonc': 'JSON with Comments',
    '.json5': 'JSON5',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.toml': 'TOML',
    '.xml': 'XML',
    '.ini': 'INI',
    '.cfg': 'INI',
    '.conf': 'INI',
    '.properties': 'Java Properties',

    // Markdown/Text
    '.md': 'Markdown',
    '.markdown': 'Markdown',
    '.mdx': 'MDX',
    '.rst': 'reStructuredText',
    '.txt': 'Text',
    '.tex': 'TeX',
    '.latex': 'TeX',

    // SQL
    '.sql': 'SQL',
    '.mysql': 'SQL',
    '.pgsql': 'PLpgSQL',

    // Other languages
    '.r': 'R',
    '.R': 'R',
    '.lua': 'Lua',
    '.pl': 'Perl',
    '.pm': 'Perl',
    '.ex': 'Elixir',
    '.exs': 'Elixir',
    '.erl': 'Erlang',
    '.hrl': 'Erlang',
    '.hs': 'Haskell',
    '.lhs': 'Literate Haskell',
    '.ml': 'OCaml',
    '.mli': 'OCaml',
    '.elm': 'Elm',
    '.dart': 'Dart',
    '.v': 'Verilog',
    '.sv': 'SystemVerilog',
    '.vhd': 'VHDL',
    '.vhdl': 'VHDL',

    // DevOps/Infrastructure
    '.dockerfile': 'Dockerfile',
    '.tf': 'HCL',
    '.hcl': 'HCL',
    '.proto': 'Protocol Buffer',
    '.graphql': 'GraphQL',
    '.gql': 'GraphQL',

    // Build files
    '.cmake': 'CMake',
    '.make': 'Makefile',
    '.mk': 'Makefile',

    // Misc
    '.diff': 'Diff',
    '.patch': 'Diff',
    '.zig': 'Zig',
    '.nim': 'Nim',
    '.nix': 'Nix',
    '.prisma': 'Prisma',
    '.wasm': 'WebAssembly',
    '.wat': 'WebAssembly',
    '.sol': 'Solidity',
};

/**
 * Special filename to language mappings for files without extensions
 * or with specific names that override extension-based detection.
 */
const filenameToLanguageMap: Record<string, string> = {
    'Dockerfile': 'Dockerfile',
    'Makefile': 'Makefile',
    'GNUmakefile': 'Makefile',
    'makefile': 'Makefile',
    'Rakefile': 'Ruby',
    'Gemfile': 'Ruby',
    'Podfile': 'Ruby',
    'Vagrantfile': 'Ruby',
    'BUILD': 'Starlark',
    'BUILD.bazel': 'Starlark',
    'WORKSPACE': 'Starlark',
    'WORKSPACE.bazel': 'Starlark',
    '.gitignore': 'Ignore List',
    '.gitattributes': 'Git Attributes',
    '.editorconfig': 'EditorConfig',
    '.babelrc': 'JSON',
    '.eslintrc': 'JSON',
    '.prettierrc': 'JSON',
    'tsconfig.json': 'JSON with Comments',
    'jsconfig.json': 'JSON with Comments',
    '.env': 'Dotenv',
    '.env.local': 'Dotenv',
    '.env.development': 'Dotenv',
    '.env.production': 'Dotenv',
};

/**
 * Determines the GitHub Linguist language name from a file name.
 * Used for syntax highlighting in the UI.
 * 
 * @param fileName - The name or path of the file
 * @returns The Linguist language name, or empty string if unknown
 */
const getLanguageFromFileName = (fileName: string): string => {
    // Get the base name of the file (without directory path)
    const baseName = path.basename(fileName);

    // Check for special filenames first
    if (filenameToLanguageMap[baseName]) {
        return filenameToLanguageMap[baseName];
    }

    // Get the file extension (including the dot)
    const ext = path.extname(fileName).toLowerCase();

    // Return the language for the extension, or empty string if unknown
    return extensionToLanguageMap[ext] ?? '';
};
