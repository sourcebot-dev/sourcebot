import { describe, expect, test } from 'vitest';
import { ASK_COMMAND_SOURCE_SHARED_SKILL, ASK_COMMAND_SOURCE_PERSONAL_SKILL, type AskCommandDefinition } from './types';
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

    test('keeps commands with the same slug from different sources', () => {
        const commands = [
            command({ id: 'personal-skill', sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL, slug: 'review' }),
            command({ id: 'shared-skill', sourceId: ASK_COMMAND_SOURCE_SHARED_SKILL, slug: 'review' }),
        ];

        expect(filterAskCommandDefinitions(commands, '/review').map((item) => item.id)).toEqual([
            'personal-skill',
            'shared-skill',
        ]);
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

    test('returns the invocation snapshot for a leading command mention', () => {
        expect(createCommandInvocationData('/review-pr src/auth/session.ts\n', [commandMention])).toEqual(commandMention);
    });

    test('returns the invocation snapshot when text appears before the command mention', () => {
        expect(createCommandInvocationData('please /review-pr src/auth/session.ts', [commandMention])).toEqual(commandMention);
    });

    test('returns the invocation snapshot when the command has no trailing text', () => {
        expect(createCommandInvocationData('/review-pr', [commandMention])).toEqual(commandMention);
        expect(createCommandInvocationData('/review-pr\n', [commandMention])).toEqual(commandMention);
    });

    test('preserves the command source label when present', () => {
        expect(createCommandInvocationData('/review-pr src/auth/session.ts\n', [{
            ...commandMention,
            sourceLabel: 'Personal',
        }])).toEqual({
            ...commandMention,
            sourceLabel: 'Personal',
        });
    });

    test('does not match adjacent command-like text', () => {
        expect(createCommandInvocationData('/review-pr-extra src/auth/session.ts', [commandMention])).toBeUndefined();
    });

    test('does not match a command preceded by non-whitespace', () => {
        expect(createCommandInvocationData('foo/review-pr src/auth/session.ts', [commandMention])).toBeUndefined();
    });

    test('skips an embedded false match and resolves a later valid occurrence', () => {
        expect(createCommandInvocationData('x/review-prX then /review-pr real', [commandMention])).toEqual(commandMention);
    });
});
