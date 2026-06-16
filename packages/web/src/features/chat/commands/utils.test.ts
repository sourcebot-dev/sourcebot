import { describe, expect, test } from 'vitest';
import { ASK_COMMAND_SOURCE_PERSONAL_SKILL, type AskCommandDefinition } from './types';
import { createCommandInvocationData, filterAskCommandDefinitions, toAskCommandSuggestion } from './utils';

const command = (overrides: Partial<AskCommandDefinition>): AskCommandDefinition => ({
    id: 'skill-1',
    sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL,
    slug: 'review-pr',
    name: 'Review PR',
    description: 'Review changes for risky code.',
    ...overrides,
});

describe('filterAskCommandDefinitions', () => {
    test('returns visible commands for an empty query', () => {
        const commands = [
            command({ id: 'visible' }),
            command({ id: 'hidden', isHidden: true }),
        ];

        expect(filterAskCommandDefinitions(commands, '').map((item) => item.id)).toEqual(['visible']);
    });

    test('matches slug, name, description, and aliases', () => {
        const commands = [
            command({ id: 'slug', slug: 'release-notes', name: 'Release notes', description: '' }),
            command({ id: 'name', slug: 'ship', name: 'Deploy Checklist', description: '' }),
            command({ id: 'description', slug: 'audit', name: 'Audit', description: 'Find security risks.' }),
            command({ id: 'alias', slug: 'summarize', name: 'Summarize', description: '', aliases: ['tl-dr'] }),
        ];

        expect(filterAskCommandDefinitions(commands, 'release').map((item) => item.id)).toEqual(['slug']);
        expect(filterAskCommandDefinitions(commands, 'deploy').map((item) => item.id)).toEqual(['name']);
        expect(filterAskCommandDefinitions(commands, 'security').map((item) => item.id)).toEqual(['description']);
        expect(filterAskCommandDefinitions(commands, 'tl-dr').map((item) => item.id)).toEqual(['alias']);
    });

    test('normalizes a leading slash in the query', () => {
        expect(filterAskCommandDefinitions([command({})], '/review').map((item) => item.id)).toEqual(['skill-1']);
    });
});

describe('toAskCommandSuggestion', () => {
    test('adds the command suggestion discriminator', () => {
        expect(toAskCommandSuggestion(command({}))).toMatchObject({
            type: 'command',
            slug: 'review-pr',
        });
    });
});

describe('createCommandInvocationData', () => {
    const commandMention = {
        type: 'command' as const,
        commandId: 'skill-1',
        sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL,
        slug: 'review-pr',
        name: 'Review PR',
    };

    test('captures raw arguments after a leading command mention', () => {
        expect(createCommandInvocationData('/review-pr src/auth/session.ts\n', [commandMention])).toEqual({
            ...commandMention,
            rawArguments: 'src/auth/session.ts',
        });
    });

    test('does not include UI-only argument hints in invocation data', () => {
        expect(createCommandInvocationData('/review-pr src/auth/session.ts\n', [{
            ...commandMention,
            argumentHint: '<path>',
        }])).toEqual({
            ...commandMention,
            rawArguments: 'src/auth/session.ts',
        });
    });

    test('captures arguments when text appears before the command mention', () => {
        expect(createCommandInvocationData('please /review-pr src/auth/session.ts', [commandMention])).toEqual({
            ...commandMention,
            rawArguments: 'src/auth/session.ts',
        });
    });

    test('does not match adjacent command-like text', () => {
        expect(createCommandInvocationData('/review-pr-extra src/auth/session.ts', [commandMention])).toBeUndefined();
    });

    test('captures empty raw arguments when the command has none', () => {
        expect(createCommandInvocationData('/review-pr', [commandMention])).toEqual({
            ...commandMention,
            rawArguments: '',
        });
        expect(createCommandInvocationData('/review-pr\n', [commandMention])).toEqual({
            ...commandMention,
            rawArguments: '',
        });
    });

    test('does not match a command preceded by non-whitespace', () => {
        expect(createCommandInvocationData('foo/review-pr src/auth/session.ts', [commandMention])).toBeUndefined();
    });

    test('skips an embedded false match and resolves a later valid occurrence', () => {
        expect(createCommandInvocationData('x/review-prX then /review-pr real', [commandMention])).toEqual({
            ...commandMention,
            rawArguments: 'real',
        });
    });
});
