import { expect, test, vi } from 'vitest'
import { fileReferenceToString, getAnswerPartFromAssistantMessage, groupMessageIntoSteps, repairReferences, buildSearchQuery, convertLLMOutputToPortableMarkdown, buildCodeHostFileUrl } from './utils'
import { FILE_REFERENCE_REGEX, ANSWER_TAG } from './constants';
import { SBChatMessage, SBChatMessagePart } from './types';

// Mock the env module
vi.mock('@sourcebot/shared', () => ({
    env: {
        SOURCEBOT_CHAT_FILE_MAX_CHARACTERS: 4000,
    }
}));


test('fileReferenceToString formats file references correctly', () => {
    expect(fileReferenceToString({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'auth.ts'
    })).toBe('@file:{github.com/sourcebot-dev/sourcebot::auth.ts}');

    expect(fileReferenceToString({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'auth.ts',
        range: {
            startLine: 45,
            endLine: 60,
        }
    })).toBe('@file:{github.com/sourcebot-dev/sourcebot::auth.ts:45-60}');
});

test('fileReferenceToString matches FILE_REFERENCE_REGEX', () => {
    expect(FILE_REFERENCE_REGEX.test(fileReferenceToString({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'auth.ts'
    }))).toBe(true);

    FILE_REFERENCE_REGEX.lastIndex = 0;
    expect(FILE_REFERENCE_REGEX.test(fileReferenceToString({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'auth.ts',
        range: {
            startLine: 45,
            endLine: 60,
        }
    }))).toBe(true);
});

test('groupMessageIntoSteps returns an empty array when there are no parts', () => {
    const parts: SBChatMessagePart[] = []

    const steps = groupMessageIntoSteps(parts);

    expect(steps).toEqual([]);
});

test('groupMessageIntoSteps returns a single group when there is only one step-start part', () => {
    const parts: SBChatMessagePart[] = [
        {
            type: 'step-start',
        },
        {
            type: 'text',
            text: 'Hello, world!',
        }
    ]

    const steps = groupMessageIntoSteps(parts);

    expect(steps).toEqual([
        [
            {
                type: 'step-start',
            },
            {
                type: 'text',
                text: 'Hello, world!',
            }
        ]
    ]);
});

test('groupMessageIntoSteps returns a multiple groups when there is multiple step-start parts', () => {
    const parts: SBChatMessagePart[] = [
        {
            type: 'step-start',
        },
        {
            type: 'text',
            text: 'Hello, world!',
        },
        {
            type: 'step-start',
        },
        {
            type: 'text',
            text: 'Ok lets go',
        },
    ]

    const steps = groupMessageIntoSteps(parts);

    expect(steps).toEqual([
        [
            {
                type: 'step-start',
            },
            {
                type: 'text',
                text: 'Hello, world!',
            }
        ],
        [
            {
                type: 'step-start',
            },
            {
                type: 'text',
                text: 'Ok lets go',
            }
        ]
    ]);
});

test('groupMessageIntoSteps returns a single group when there is no step-start part', () => {
    const parts: SBChatMessagePart[] = [
        {
            type: 'text',
            text: 'Hello, world!',
        },
        {
            type: 'text',
            text: 'Ok lets go',
        },
    ]

    const steps = groupMessageIntoSteps(parts);

    expect(steps).toEqual([
        [
            {
                type: 'text',
                text: 'Hello, world!',
            },
            {
                type: 'text',
                text: 'Ok lets go',
            }
        ]
    ]);
});

test('getAnswerPartFromAssistantMessage returns text part when it starts with ANSWER_TAG while not streaming', () => {
    const message: SBChatMessage = {
        role: 'assistant',
        parts: [
            {
                type: 'text',
                text: 'Some initial text'
            },
            {
                type: 'text',
                text: `${ANSWER_TAG}This is the answer to your question.`
            }
        ]
    } as SBChatMessage;

    const result = getAnswerPartFromAssistantMessage(message, false);

    expect(result).toEqual({
        type: 'text',
        text: `${ANSWER_TAG}This is the answer to your question.`
    });
});

test('getAnswerPartFromAssistantMessage returns text part when it starts with ANSWER_TAG while streaming', () => {
    const message: SBChatMessage = {
        role: 'assistant',
        parts: [
            {
                type: 'text',
                text: 'Some initial text'
            },
            {
                type: 'text',
                text: `${ANSWER_TAG}This is the answer to your question.`
            }
        ]
    } as SBChatMessage;

    const result = getAnswerPartFromAssistantMessage(message, true);

    expect(result).toEqual({
        type: 'text',
        text: `${ANSWER_TAG}This is the answer to your question.`
    });
});

test('getAnswerPartFromAssistantMessage returns last text part as fallback when not streaming and no ANSWER_TAG', () => {
    const message: SBChatMessage = {
        role: 'assistant',
        parts: [
            {
                type: 'text',
                text: 'First text part'
            },
            {
                type: 'tool-call',
                id: 'call-1',
                name: 'search',
                args: {}
            },
            {
                type: 'text',
                text: 'This is the last text part without answer tag'
            }
        ]
    } as SBChatMessage;

    const result = getAnswerPartFromAssistantMessage(message, false);

    expect(result).toEqual({
        type: 'text',
        text: 'This is the last text part without answer tag'
    });
});

test('getAnswerPartFromAssistantMessage returns undefined when streaming and no ANSWER_TAG', () => {
    const message: SBChatMessage = {
        role: 'assistant',
        parts: [
            {
                type: 'text',
                text: 'Some text without answer tag'
            },
            {
                type: 'text',
                text: 'Another text part'
            }
        ]
    } as SBChatMessage;

    const result = getAnswerPartFromAssistantMessage(message, true);

    expect(result).toBeUndefined();
});

test('repairReferences fixes missing colon after @file', () => {
    const input = 'See the function in @file{github.com/sourcebot-dev/sourcebot::auth.ts} for details.';
    const expected = 'See the function in @file:{github.com/sourcebot-dev/sourcebot::auth.ts} for details.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences fixes missing colon with range', () => {
    const input = 'Check @file{github.com/sourcebot-dev/sourcebot::config.ts:15-20} for the configuration.';
    const expected = 'Check @file:{github.com/sourcebot-dev/sourcebot::config.ts:15-20} for the configuration.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences fixes missing braces around filename', () => {
    const input = 'The logic is in @file:github.com/sourcebot-dev/sourcebot::utils.js and handles validation.';
    const expected = 'The logic is in @file:{github.com/sourcebot-dev/sourcebot::utils.js} and handles validation.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences fixes missing braces with path', () => {
    const input = 'Look at @file:github.com/sourcebot-dev/sourcebot::src/components/Button.tsx for the component.';
    const expected = 'Look at @file:{github.com/sourcebot-dev/sourcebot::src/components/Button.tsx} for the component.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences removes multiple ranges keeping only first', () => {
    const input = 'See @file:{github.com/sourcebot-dev/sourcebot::service.ts:10-15,20-25,30-35} for implementation.';
    const expected = 'See @file:{github.com/sourcebot-dev/sourcebot::service.ts:10-15} for implementation.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences fixes malformed triple number ranges', () => {
    const input = 'Check @file:{github.com/sourcebot-dev/sourcebot::handler.ts:5-10-15} for the logic.';
    const expected = 'Check @file:{github.com/sourcebot-dev/sourcebot::handler.ts:5-10} for the logic.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences handles multiple citations in same text', () => {
    const input = 'See @file{github.com/sourcebot-dev/sourcebot::auth.ts} and @file:github.com/sourcebot-dev/sourcebot::config.js for setup details.';
    const expected = 'See @file:{github.com/sourcebot-dev/sourcebot::auth.ts} and @file:{github.com/sourcebot-dev/sourcebot::config.js} for setup details.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences leaves correctly formatted citations unchanged', () => {
    const input = 'The function @file:{github.com/sourcebot-dev/sourcebot::utils.ts:42-50} handles validation correctly.';
    expect(repairReferences(input)).toBe(input);
});

test('repairReferences handles edge cases with spaces and punctuation', () => {
    const input = 'Functions like @file:github.com/sourcebot-dev/sourcebot::helper.ts, @file{github.com/sourcebot-dev/sourcebot::main.js}, and @file:{github.com/sourcebot-dev/sourcebot::app.ts:1-5,10-15} work.';
    const expected = 'Functions like @file:{github.com/sourcebot-dev/sourcebot::helper.ts}, @file:{github.com/sourcebot-dev/sourcebot::main.js}, and @file:{github.com/sourcebot-dev/sourcebot::app.ts:1-5} work.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences returns empty string unchanged', () => {
    expect(repairReferences('')).toBe('');
});

test('repairReferences returns text without citations unchanged', () => {
    const input = 'This is just regular text without any file references.';
    expect(repairReferences(input)).toBe(input);
});

test('repairReferences handles complex file paths correctly', () => {
    const input = 'Check @file:github.com/sourcebot-dev/sourcebot::src/components/ui/Button/index.tsx for implementation.';
    const expected = 'Check @file:{github.com/sourcebot-dev/sourcebot::src/components/ui/Button/index.tsx} for implementation.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences handles files with numbers and special characters', () => {
    const input = 'See @file{github.com/sourcebot-dev/sourcebot::utils-v2.0.1.ts} and @file:github.com/sourcebot-dev/sourcebot::config_2024.json for setup.';
    const expected = 'See @file:{github.com/sourcebot-dev/sourcebot::utils-v2.0.1.ts} and @file:{github.com/sourcebot-dev/sourcebot::config_2024.json} for setup.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences handles citation at end of sentence', () => {
    const input = 'The implementation is in @file:github.com/sourcebot-dev/sourcebot::helper.ts.';
    const expected = 'The implementation is in @file:{github.com/sourcebot-dev/sourcebot::helper.ts}.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences preserves already correct citations with ranges', () => {
    const input = 'The function @file:{github.com/sourcebot-dev/sourcebot::utils.ts:10-20} and variable @file:{github.com/sourcebot-dev/sourcebot::config.js:5} work correctly.';
    expect(repairReferences(input)).toBe(input);
});

test('repairReferences handles extra closing parenthesis', () => {
    const input = 'See @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts:5-6)} for details.';
    const expected = 'See @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts:5-6} for details.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences handles extra colon at end of range', () => {
    const input = 'See @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts:5-6:} for details.';
    const expected = 'See @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts:5-6} for details.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences handles inline code blocks around file references', () => {
    const input = 'See `@file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts}` for details.';
    const expected = 'See @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts} for details.';
    expect(repairReferences(input)).toBe(expected);
});

test('repairReferences handles malformed inline code blocks', () => {
    const input = 'See `@file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts`} for details.';
    const expected = 'See @file:{github.com/sourcebot-dev/sourcebot::packages/web/src/auth.ts} for details.';
    expect(repairReferences(input)).toBe(expected);
});

test('buildSearchQuery returns base query when no filters provided', () => {
    const result = buildSearchQuery({
        query: 'console.log'
    });
    
    expect(result).toBe('console.log');
});

test('buildSearchQuery adds repoNamesFilter correctly', () => {
    const result = buildSearchQuery({
        query: 'function test',
        repoNamesFilter: ['repo1', 'repo2']
    });
    
    expect(result).toBe('function test reposet:repo1,repo2');
});

test('buildSearchQuery adds single repoNamesFilter correctly', () => {
    const result = buildSearchQuery({
        query: 'function test',
        repoNamesFilter: ['myrepo']
    });
    
    expect(result).toBe('function test reposet:myrepo');
});

test('buildSearchQuery ignores empty repoNamesFilter', () => {
    const result = buildSearchQuery({
        query: 'function test',
        repoNamesFilter: []
    });
    
    expect(result).toBe('function test');
});

test('buildSearchQuery adds languageNamesFilter correctly', () => {
    const result = buildSearchQuery({
        query: 'class definition',
        languageNamesFilter: ['typescript', 'javascript']
    });
    
    expect(result).toBe('class definition ( lang:typescript or lang:javascript )');
});

test('buildSearchQuery adds single languageNamesFilter correctly', () => {
    const result = buildSearchQuery({
        query: 'class definition',
        languageNamesFilter: ['python']
    });
    
    expect(result).toBe('class definition ( lang:python )');
});

test('buildSearchQuery ignores empty languageNamesFilter', () => {
    const result = buildSearchQuery({
        query: 'class definition',
        languageNamesFilter: []
    });
    
    expect(result).toBe('class definition');
});

test('buildSearchQuery adds fileNamesFilterRegexp correctly', () => {
    const result = buildSearchQuery({
        query: 'import statement',
        fileNamesFilterRegexp: ['*.ts', '*.js']
    });
    
    expect(result).toBe('import statement ( file:*.ts or file:*.js )');
});

test('buildSearchQuery adds single fileNamesFilterRegexp correctly', () => {
    const result = buildSearchQuery({
        query: 'import statement',
        fileNamesFilterRegexp: ['*.tsx']
    });
    
    expect(result).toBe('import statement ( file:*.tsx )');
});

test('buildSearchQuery ignores empty fileNamesFilterRegexp', () => {
    const result = buildSearchQuery({
        query: 'import statement',
        fileNamesFilterRegexp: []
    });
    
    expect(result).toBe('import statement');
});

test('buildSearchQuery adds repoNamesFilterRegexp correctly', () => {
    const result = buildSearchQuery({
        query: 'bug fix',
        repoNamesFilterRegexp: ['org/repo1', 'org/repo2']
    });
    
    expect(result).toBe('bug fix ( repo:org/repo1 or repo:org/repo2 )');
});

test('buildSearchQuery adds single repoNamesFilterRegexp correctly', () => {
    const result = buildSearchQuery({
        query: 'bug fix',
        repoNamesFilterRegexp: ['myorg/myrepo']
    });
    
    expect(result).toBe('bug fix ( repo:myorg/myrepo )');
});

test('buildSearchQuery ignores empty repoNamesFilterRegexp', () => {
    const result = buildSearchQuery({
        query: 'bug fix',
        repoNamesFilterRegexp: []
    });
    
    expect(result).toBe('bug fix');
});

test('buildSearchQuery combines multiple filters correctly', () => {
    const result = buildSearchQuery({
        query: 'authentication',
        repoNamesFilter: ['backend', 'frontend'],
        languageNamesFilter: ['typescript', 'javascript'],
        fileNamesFilterRegexp: ['*.ts', '*.js'],
        repoNamesFilterRegexp: ['org/auth-*']
    });
    
    expect(result).toBe(
        'authentication reposet:backend,frontend ( lang:typescript or lang:javascript ) ( file:*.ts or file:*.js ) ( repo:org/auth-* )'
    );
});

test('buildSearchQuery handles mixed empty and non-empty filters', () => {
    const result = buildSearchQuery({
        query: 'error handling',
        repoNamesFilter: [],
        languageNamesFilter: ['python'],
        fileNamesFilterRegexp: [],
        repoNamesFilterRegexp: ['error/*']
    });
    
    expect(result).toBe('error handling ( lang:python ) ( repo:error/* )');
});

test('buildSearchQuery handles empty base query', () => {
    const result = buildSearchQuery({
        query: '',
        repoNamesFilter: ['repo1'],
        languageNamesFilter: ['typescript']
    });
    
    expect(result).toBe(' reposet:repo1 ( lang:typescript )');
});

test('buildSearchQuery handles query with special characters', () => {
    const result = buildSearchQuery({
        query: 'console.log("hello world")',
        repoNamesFilter: ['test-repo']
    });
    
    expect(result).toBe('console.log("hello world") reposet:test-repo');
});

test('convertLLMOutputToPortableMarkdown removes answer tag', () => {
    const text = `${ANSWER_TAG}This is the answer.`;
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('This is the answer.');
});

test('convertLLMOutputToPortableMarkdown converts GitHub file references to full URLs with default branch', () => {
    const text = 'Check out @file:{github.com/sourcebot-dev/sourcebot::docker-compose.yml} for the config.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check out [docker-compose.yml](https://github.com/sourcebot-dev/sourcebot/blob/main/docker-compose.yml) for the config.');
});

test('convertLLMOutputToPortableMarkdown converts GitHub file references with line numbers', () => {
    const text = 'See @file:{github.com/sourcebot-dev/sourcebot::src/auth.ts:45} for details.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [auth.ts:45](https://github.com/sourcebot-dev/sourcebot/blob/main/src/auth.ts#L45) for details.');
});

test('convertLLMOutputToPortableMarkdown converts GitHub file references with line ranges', () => {
    const text = 'Check @file:{github.com/sourcebot-dev/sourcebot::src/utils.ts:10-20} for implementation.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [utils.ts:10-20](https://github.com/sourcebot-dev/sourcebot/blob/main/src/utils.ts#L10-L20) for implementation.');
});

test('convertLLMOutputToPortableMarkdown removes answer tag', () => {
    const text = `${ANSWER_TAG}Hello world`;
    expect(convertLLMOutputToPortableMarkdown(text)).toBe('Hello world');
});

test('convertLLMOutputToPortableMarkdown converts GitHub file references', () => {
    const text = 'Check @file:{github.com/owner/repo::file.ts} for code.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [file.ts](https://github.com/owner/repo/blob/main/file.ts) for code.');
});

test('convertLLMOutputToPortableMarkdown converts GitHub with line numbers', () => {
    const text = 'See @file:{github.com/owner/repo::src/file.ts:10-20} for implementation.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [file.ts:10-20](https://github.com/owner/repo/blob/main/src/file.ts#L10-L20) for implementation.');
});

test('convertLLMOutputToPortableMarkdown converts GitHub with single line', () => {
    const text = 'Look at @file:{github.com/owner/repo::file.ts:42}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Look at [file.ts:42](https://github.com/owner/repo/blob/main/file.ts#L42)');
});

test('convertLLMOutputToPortableMarkdown uses custom branch from sources', () => {
    const text = 'Check @file:{github.com/owner/repo::README.md:5-10} for docs.';
    const sources = [{
        type: 'file' as const,
        repo: 'github.com/owner/repo',
        path: 'README.md',
        name: 'README.md',
        language: 'markdown',
        revision: 'dev',
    }];
    const result = convertLLMOutputToPortableMarkdown(text, { sources });
    expect(result).toBe('Check [README.md:5-10](https://github.com/owner/repo/blob/dev/README.md?plain=1#L5-L10) for docs.');
});

test('convertLLMOutputToPortableMarkdown converts GitLab file references', () => {
    const text = 'Check @file:{gitlab.com/owner/repo::file.ts} for code.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [file.ts](https://gitlab.com/owner/repo/-/blob/main/file.ts) for code.');
});

test('convertLLMOutputToPortableMarkdown converts GitLab with line numbers', () => {
    const text = 'See @file:{gitlab.com/owner/repo::src/file.ts:10-20}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [file.ts:10-20](https://gitlab.com/owner/repo/-/blob/main/src/file.ts#L10-20)');
});

test('convertLLMOutputToPortableMarkdown converts self-hosted GitLab', () => {
    const text = 'Check @file:{gitlab.example.com/owner/repo::file.ts}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [file.ts](https://gitlab.example.com/owner/repo/-/blob/main/file.ts)');
});

test('convertLLMOutputToPortableMarkdown converts Bitbucket file references', () => {
    const text = 'Check @file:{bitbucket.org/owner/repo::file.ts} for code.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [file.ts](https://bitbucket.org/owner/repo/src/main/file.ts) for code.');
});

test('convertLLMOutputToPortableMarkdown converts Bitbucket with line numbers', () => {
    const text = 'See @file:{bitbucket.org/owner/repo::src/file.ts:10-20}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [file.ts:10-20](https://bitbucket.org/owner/repo/src/main/src/file.ts#lines-10:20)');
});

test('convertLLMOutputToPortableMarkdown handles generic git hosts', () => {
    const text = 'Check @file:{git.example.com/owner/repo::file.ts}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [file.ts](https://git.example.com/owner/repo/src/branch/main/file.ts)');
});

test('convertLLMOutputToPortableMarkdown handles multiple file references', () => {
    const text = 'See @file:{github.com/org/repo::file1.ts:10} and @file:{gitlab.com/org/repo::file2.ts:20-30}.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [file1.ts:10](https://github.com/org/repo/blob/main/file1.ts#L10) and [file2.ts:20-30](https://gitlab.com/org/repo/-/blob/main/file2.ts#L20-30).');
});

test('convertLLMOutputToPortableMarkdown handles files with nested paths', () => {
    const text = 'See @file:{github.com/org/repo::src/features/auth/utils.ts:100-150}.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [utils.ts:100-150](https://github.com/org/repo/blob/main/src/features/auth/utils.ts#L100-L150).');
});

test('convertLLMOutputToPortableMarkdown strips leading slashes from file paths', () => {
    const text = 'Check @file:{github.com/org/repo::/path/to/file.ts}.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [file.ts](https://github.com/org/repo/blob/main/path/to/file.ts).');
});

test('convertLLMOutputToPortableMarkdown uses custom branch from sources for specific repos', () => {
    const text = 'Files: @file:{github.com/org/repo1::file1.ts} and @file:{github.com/org/repo2::file2.ts}.';
    const sources = [
        {
            type: 'file' as const,
            repo: 'github.com/org/repo1',
            path: 'file1.ts',
            name: 'file1.ts',
            language: 'typescript',
            revision: 'feature/test',
        },
        {
            type: 'file' as const,
            repo: 'github.com/org/repo2',
            path: 'file2.ts',
            name: 'file2.ts',
            language: 'typescript',
            revision: 'v1.0.0',
        }
    ];
    const result = convertLLMOutputToPortableMarkdown(text, { sources });
    expect(result).toBe('Files: [file1.ts](https://github.com/org/repo1/blob/feature/test/file1.ts) and [file2.ts](https://github.com/org/repo2/blob/v1.0.0/file2.ts).');
});

test('convertLLMOutputToPortableMarkdown handles answer tag and file references together', () => {
    const text = `${ANSWER_TAG}The config is in @file:{github.com/org/repo::config.json:5-10}.`;
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('The config is in [config.json:5-10](https://github.com/org/repo/blob/main/config.json#L5-L10).');
});

test('convertLLMOutputToPortableMarkdown trims whitespace', () => {
    const text = `  ${ANSWER_TAG}  Some text.  `;
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Some text.');
});

test('convertLLMOutputToPortableMarkdown uses revision from sources for GitLab', () => {
    const text = 'Check @file:{gitlab.com/owner/repo::file.ts}';
    const sources = [{
        type: 'file' as const,
        repo: 'gitlab.com/owner/repo',
        path: 'file.ts',
        name: 'file.ts',
        language: 'typescript',
        revision: 'v2.0.0',
    }];
    const result = convertLLMOutputToPortableMarkdown(text, { sources });
    expect(result).toBe('Check [file.ts](https://gitlab.com/owner/repo/-/blob/v2.0.0/file.ts)');
});

test('convertLLMOutputToPortableMarkdown uses revision from sources for Bitbucket', () => {
    const text = 'Check @file:{bitbucket.org/owner/repo::file.ts:5}';
    const sources = [{
        type: 'file' as const,
        repo: 'bitbucket.org/owner/repo',
        path: 'file.ts',
        name: 'file.ts',
        language: 'typescript',
        revision: 'feature/new-ui',
    }];
    const result = convertLLMOutputToPortableMarkdown(text, { sources });
    expect(result).toBe('Check [file.ts:5](https://bitbucket.org/owner/repo/src/feature/new-ui/file.ts#lines-5)');
});

test('convertLLMOutputToPortableMarkdown converts Azure DevOps file references', () => {
    const text = 'See @file:{dev.azure.com/org/project/repo::src/app.ts}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [app.ts](https://dev.azure.com/org/project/_git/repo?path=/src/app.ts&version=GBmain)');
});

test('convertLLMOutputToPortableMarkdown converts Azure DevOps with line numbers', () => {
    const text = 'Check @file:{dev.azure.com/org/project/repo::src/service.ts:10-20}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [service.ts:10-20](https://dev.azure.com/org/project/_git/repo?path=/src/service.ts&version=GBmain&line=10&lineEnd=20)');
});

test('convertLLMOutputToPortableMarkdown converts Azure DevOps with custom branch', () => {
    const text = 'See @file:{dev.azure.com/org/project/repo::config.json}';
    const sources = [{
        type: 'file' as const,
        repo: 'dev.azure.com/org/project/repo',
        path: 'config.json',
        name: 'config.json',
        language: 'json',
        revision: 'develop',
    }];
    const result = convertLLMOutputToPortableMarkdown(text, { sources });
    expect(result).toBe('See [config.json](https://dev.azure.com/org/project/_git/repo?path=/config.json&version=GBdevelop)');
});

test('convertLLMOutputToPortableMarkdown converts Gitea file references', () => {
    const text = 'Check @file:{gitea.example.com/owner/repo::README.md}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [README.md](https://gitea.example.com/owner/repo/src/branch/main/README.md)');
});

test('convertLLMOutputToPortableMarkdown converts Gitea with line numbers', () => {
    const text = 'See @file:{gitea.example.com/owner/repo::src/main.go:5-10}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [main.go:5-10](https://gitea.example.com/owner/repo/src/branch/main/src/main.go#L5-L10)');
});

test('convertLLMOutputToPortableMarkdown converts Gitea with custom branch', () => {
    const text = 'Check @file:{gitea.internal/company/project::app.js}';
    const sources = [{
        type: 'file' as const,
        repo: 'gitea.internal/company/project',
        path: 'app.js',
        name: 'app.js',
        language: 'javascript',
        revision: 'feature-branch',
    }];
    const result = convertLLMOutputToPortableMarkdown(text, { sources });
    expect(result).toBe('Check [app.js](https://gitea.internal/company/project/src/branch/feature-branch/app.js)');
});

test('convertLLMOutputToPortableMarkdown converts Gerrit file references', () => {
    const text = 'See @file:{gerrit.example.com/project::src/core.java}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [core.java](https://gerrit.example.com/plugins/gitiles/project/+/refs/heads/main/src/core.java)');
});

test('convertLLMOutputToPortableMarkdown converts Gerrit with line number', () => {
    const text = 'Check @file:{gerrit.company.org/backend::api/handler.py:42}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [handler.py:42](https://gerrit.company.org/plugins/gitiles/backend/+/refs/heads/main/api/handler.py#42)');
});

test('convertLLMOutputToPortableMarkdown converts Gerrit with custom branch', () => {
    const text = 'See @file:{gerrit.internal/myproject::config.yaml}';
    const sources = [{
        type: 'file' as const,
        repo: 'gerrit.internal/myproject',
        path: 'config.yaml',
        name: 'config.yaml',
        language: 'yaml',
        revision: 'release-v2',
    }];
    const result = convertLLMOutputToPortableMarkdown(text, { sources });
    expect(result).toBe('See [config.yaml](https://gerrit.internal/plugins/gitiles/myproject/+/refs/heads/release-v2/config.yaml)');
});

test('convertLLMOutputToPortableMarkdown handles GitHub Enterprise', () => {
    const text = 'Check @file:{github.company.com/org/repo::src/app.ts}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [app.ts](https://github.company.com/org/repo/blob/main/src/app.ts)');
});

test('convertLLMOutputToPortableMarkdown handles multi-segment repository names', () => {
    const text = 'See @file:{github.com/org/sub-org/repo::file.js}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [file.js](https://github.com/org/sub-org/repo/blob/main/file.js)');
});

test('convertLLMOutputToPortableMarkdown handles complex Azure DevOps with multi-segment repo', () => {
    const text = 'Check @file:{dev.azure.com/org/project/sub/repo::app.cs:10}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [app.cs:10](https://dev.azure.com/org/project/_git/sub/repo?path=/app.cs&version=GBmain&line=10)');
});

test('convertLLMOutputToPortableMarkdown fallback for invalid repo format', () => {
    const text = 'See @file:{invalidrepo::file.txt}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [file.txt](file.txt)');
});

test('convertLLMOutputToPortableMarkdown preserves text without file references', () => {
    const text = 'This is just plain text without any file references.';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('This is just plain text without any file references.');
});

test('convertLLMOutputToPortableMarkdown handles GitHub markdown files with ?plain=1', () => {
    const text = 'See @file:{github.com/owner/repo::README.md:10-20}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [README.md:10-20](https://github.com/owner/repo/blob/main/README.md?plain=1#L10-L20)');
});

test('convertLLMOutputToPortableMarkdown handles markdown without line numbers', () => {
    const text = 'Check @file:{github.com/owner/repo::CHANGELOG.md}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('Check [CHANGELOG.md](https://github.com/owner/repo/blob/main/CHANGELOG.md)');
});

test('convertLLMOutputToPortableMarkdown handles .mdx files', () => {
    const text = 'See @file:{github.com/owner/repo::docs/guide.mdx:15-25}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [guide.mdx:15-25](https://github.com/owner/repo/blob/main/docs/guide.mdx?plain=1#L15-L25)');
});

// Tests for buildCodeHostFileUrl function
test('buildCodeHostFileUrl builds GitHub URL correctly', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'src/app.ts', 'main');
    expect(url).toBe('https://github.com/owner/repo/blob/main/src/app.ts');
});

test('buildCodeHostFileUrl builds GitHub URL with line numbers', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'src/app.ts', 'main', '10', '20');
    expect(url).toBe('https://github.com/owner/repo/blob/main/src/app.ts#L10-L20');
});

test('buildCodeHostFileUrl builds GitHub URL with single line', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'src/app.ts', 'develop', '42');
    expect(url).toBe('https://github.com/owner/repo/blob/develop/src/app.ts#L42');
});

test('buildCodeHostFileUrl builds GitHub Enterprise URL', () => {
    const url = buildCodeHostFileUrl('github.company.com/team/project', 'lib/util.js', 'feature-branch');
    expect(url).toBe('https://github.company.com/team/project/blob/feature-branch/lib/util.js');
});

test('buildCodeHostFileUrl builds GitLab URL correctly', () => {
    const url = buildCodeHostFileUrl('gitlab.com/group/project', 'README.md', 'main');
    expect(url).toBe('https://gitlab.com/group/project/-/blob/main/README.md');
});

test('buildCodeHostFileUrl builds GitLab URL with line range', () => {
    const url = buildCodeHostFileUrl('gitlab.com/group/project', 'src/handler.py', 'dev', '5', '15');
    expect(url).toBe('https://gitlab.com/group/project/-/blob/dev/src/handler.py#L5-15');
});

test('buildCodeHostFileUrl builds self-hosted GitLab URL', () => {
    const url = buildCodeHostFileUrl('gitlab.company.org/team/repo', 'config.yml', 'staging');
    expect(url).toBe('https://gitlab.company.org/team/repo/-/blob/staging/config.yml');
});

test('buildCodeHostFileUrl builds Bitbucket Cloud URL', () => {
    const url = buildCodeHostFileUrl('bitbucket.org/workspace/repo', 'app.go', 'main');
    expect(url).toBe('https://bitbucket.org/workspace/repo/src/main/app.go');
});

test('buildCodeHostFileUrl builds Bitbucket URL with line range', () => {
    const url = buildCodeHostFileUrl('bitbucket.org/workspace/repo', 'service.ts', 'develop', '100', '150');
    expect(url).toBe('https://bitbucket.org/workspace/repo/src/develop/service.ts#lines-100:150');
});

test('buildCodeHostFileUrl builds Bitbucket Data Center URL', () => {
    const url = buildCodeHostFileUrl('bitbucket.internal.com/project/repo', 'main.c', 'master');
    expect(url).toBe('https://bitbucket.internal.com/project/repo/src/master/main.c');
});

test('buildCodeHostFileUrl builds Azure DevOps URL', () => {
    const url = buildCodeHostFileUrl('dev.azure.com/org/project/repo', 'src/app.cs', 'main');
    expect(url).toBe('https://dev.azure.com/org/project/_git/repo?path=/src/app.cs&version=GBmain');
});

test('buildCodeHostFileUrl builds Azure DevOps URL with line numbers', () => {
    const url = buildCodeHostFileUrl('dev.azure.com/org/project/repo', 'api/controller.cs', 'feature', '25', '50');
    expect(url).toBe('https://dev.azure.com/org/project/_git/repo?path=/api/controller.cs&version=GBfeature&line=25&lineEnd=50');
});

test('buildCodeHostFileUrl builds Azure DevOps URL with single line', () => {
    const url = buildCodeHostFileUrl('dev.azure.com/myorg/myproject/myrepo', 'test.js', 'dev', '10');
    expect(url).toBe('https://dev.azure.com/myorg/myproject/_git/myrepo?path=/test.js&version=GBdev&line=10');
});

test('buildCodeHostFileUrl builds Gitea URL', () => {
    const url = buildCodeHostFileUrl('gitea.example.com/user/repo', 'main.go', 'main');
    expect(url).toBe('https://gitea.example.com/user/repo/src/branch/main/main.go');
});

test('buildCodeHostFileUrl builds Gitea URL with line range', () => {
    const url = buildCodeHostFileUrl('gitea.company.net/team/project', 'src/lib.rs', 'v1.0', '30', '40');
    expect(url).toBe('https://gitea.company.net/team/project/src/branch/v1.0/src/lib.rs#L30-L40');
});

test('buildCodeHostFileUrl builds Gerrit URL', () => {
    const url = buildCodeHostFileUrl('gerrit.example.org/project', 'src/main.java', 'master');
    expect(url).toBe('https://gerrit.example.org/plugins/gitiles/project/+/refs/heads/master/src/main.java');
});

test('buildCodeHostFileUrl builds Gerrit URL with line number', () => {
    const url = buildCodeHostFileUrl('gerrit.company.com/backend', 'api.py', 'develop', '77');
    expect(url).toBe('https://gerrit.company.com/plugins/gitiles/backend/+/refs/heads/develop/api.py#77');
});

test('buildCodeHostFileUrl strips leading slashes from paths', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', '///path/to/file.js', 'main');
    expect(url).toBe('https://github.com/owner/repo/blob/main/path/to/file.js');
});

test('buildCodeHostFileUrl handles multi-segment repository names', () => {
    const url = buildCodeHostFileUrl('github.com/org/group/subgroup/repo', 'file.txt', 'main');
    expect(url).toBe('https://github.com/org/group/subgroup/repo/blob/main/file.txt');
});

test('buildCodeHostFileUrl returns original filename for invalid repo format', () => {
    const url = buildCodeHostFileUrl('invalidrepo', 'file.txt', 'main');
    expect(url).toBe('file.txt');
});

test('buildCodeHostFileUrl returns original filename for empty repo', () => {
    const url = buildCodeHostFileUrl('', 'file.txt', 'main');
    expect(url).toBe('file.txt');
});

test('buildCodeHostFileUrl handles generic git host fallback', () => {
    const url = buildCodeHostFileUrl('git.custom.com/owner/repo', 'src/app.py', 'main');
    expect(url).toBe('https://git.custom.com/owner/repo/src/branch/main/src/app.py');
});

test('buildCodeHostFileUrl handles generic git host with line numbers', () => {
    const url = buildCodeHostFileUrl('git.internal.org/team/project', 'lib/utils.rb', 'staging', '12', '18');
    expect(url).toBe('https://git.internal.org/team/project/src/branch/staging/lib/utils.rb#L12-L18');
});

test('buildCodeHostFileUrl encodes spaces in file paths', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'docs/my file.txt', 'main');
    expect(url).toBe('https://github.com/owner/repo/blob/main/docs/my%20file.txt');
});

test('buildCodeHostFileUrl encodes special characters in file paths', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'src/file (copy).js', 'main', '5');
    expect(url).toBe('https://github.com/owner/repo/blob/main/src/file%20(copy).js#L5');
});

test('buildCodeHostFileUrl encodes spaces in branch names', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'app.ts', 'feature/my branch', '10');
    expect(url).toBe('https://github.com/owner/repo/blob/feature/my%20branch/app.ts#L10');
});

test('buildCodeHostFileUrl encodes special characters in owner/repo names', () => {
    const url = buildCodeHostFileUrl('github.com/my org/my repo', 'file.js', 'main');
    expect(url).toBe('https://github.com/my%20org/my%20repo/blob/main/file.js');
});

test('buildCodeHostFileUrl encodes Azure DevOps query parameters', () => {
    const url = buildCodeHostFileUrl('dev.azure.com/org/project/repo', 'path/my file.cs', 'my branch', '10', '20');
    expect(url).toBe('https://dev.azure.com/org/project/_git/repo?path=/path/my%20file.cs&version=GBmy%20branch&line=10&lineEnd=20');
});

test('buildCodeHostFileUrl encodes GitLab paths with special characters', () => {
    const url = buildCodeHostFileUrl('gitlab.com/group/project', 'docs/file & notes.md', 'dev', '15');
    expect(url).toBe('https://gitlab.com/group/project/-/blob/dev/docs/file%20%26%20notes.md#L15');
});

test('buildCodeHostFileUrl encodes Bitbucket paths with spaces', () => {
    const url = buildCodeHostFileUrl('bitbucket.org/workspace/repo', 'src/my module.py', 'feature', '5', '10');
    expect(url).toBe('https://bitbucket.org/workspace/repo/src/feature/src/my%20module.py#lines-5:10');
});

test('buildCodeHostFileUrl encodes Gitea paths with unicode characters', () => {
    const url = buildCodeHostFileUrl('gitea.example.com/user/repo', 'docs/文档.md', 'main', '1');
    expect(url).toBe('https://gitea.example.com/user/repo/src/branch/main/docs/%E6%96%87%E6%A1%A3.md#L1');
});

test('convertLLMOutputToPortableMarkdown normalizes leading slashes in file paths', () => {
    const text = 'See @file:{github.com/owner/repo::/src/app.ts:10}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [app.ts:10](https://github.com/owner/repo/blob/main/src/app.ts#L10)');
});

test('convertLLMOutputToPortableMarkdown matches sources with normalized paths', () => {
    const text = 'Check @file:{github.com/owner/repo::/lib/utils.js:5-10}';
    const sources = [{
        type: 'file' as const,
        repo: 'github.com/owner/repo',
        path: 'lib/utils.js', // No leading slash in source
        name: 'utils.js',
        language: 'javascript',
        revision: 'develop',
    }];
    const result = convertLLMOutputToPortableMarkdown(text, { sources });
    expect(result).toBe('Check [utils.js:5-10](https://github.com/owner/repo/blob/develop/lib/utils.js#L5-L10)');
});

test('convertLLMOutputToPortableMarkdown handles multiple leading slashes', () => {
    const text = 'See @file:{gitlab.com/group/project::///deep/path/file.py:20}';
    const result = convertLLMOutputToPortableMarkdown(text);
    expect(result).toBe('See [file.py:20](https://gitlab.com/group/project/-/blob/main/deep/path/file.py#L20)');
});

test('buildCodeHostFileUrl adds ?plain=1 for GitHub markdown files with line numbers', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'README.md', 'main', '10', '20');
    expect(url).toBe('https://github.com/owner/repo/blob/main/README.md?plain=1#L10-L20');
});

test('buildCodeHostFileUrl adds ?plain=1 for GitHub markdown files with single line', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'docs/guide.md', 'develop', '5');
    expect(url).toBe('https://github.com/owner/repo/blob/develop/docs/guide.md?plain=1#L5');
});

test('buildCodeHostFileUrl does not add ?plain=1 for GitHub markdown without line numbers', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'CHANGELOG.md', 'main');
    expect(url).toBe('https://github.com/owner/repo/blob/main/CHANGELOG.md');
});

test('buildCodeHostFileUrl adds ?plain=1 for .markdown extension', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'notes.markdown', 'main', '15');
    expect(url).toBe('https://github.com/owner/repo/blob/main/notes.markdown?plain=1#L15');
});

test('buildCodeHostFileUrl handles case-insensitive markdown extensions', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'README.MD', 'main', '8', '12');
    expect(url).toBe('https://github.com/owner/repo/blob/main/README.MD?plain=1#L8-L12');
});

test('buildCodeHostFileUrl adds ?plain=1 for .mdx files with line numbers', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'docs/component.mdx', 'main', '25', '30');
    expect(url).toBe('https://github.com/owner/repo/blob/main/docs/component.mdx?plain=1#L25-L30');
});

test('buildCodeHostFileUrl adds ?plain=1 for .mdx files with single line', () => {
    const url = buildCodeHostFileUrl('github.com/owner/repo', 'pages/index.mdx', 'feature', '42');
    expect(url).toBe('https://github.com/owner/repo/blob/feature/pages/index.mdx?plain=1#L42');
});