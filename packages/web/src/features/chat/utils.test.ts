import { expect, test, vi } from 'vitest'
import { fileReferenceToString, getAnswerPartFromAssistantMessage, groupMessageIntoSteps, repairReferences } from './utils'
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
