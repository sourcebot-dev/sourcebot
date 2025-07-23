import { expect, test, vi } from 'vitest'
import { fileReferenceToString, getAnswerPartFromAssistantMessage, groupMessageIntoSteps, repairCitations } from './utils'
import { FILE_REFERENCE_REGEX, ANSWER_TAG } from './constants';
import { SBChatMessage, SBChatMessagePart } from './types';

// Mock the env module
vi.mock('@/env.mjs', () => ({
    env: {
        SOURCEBOT_CHAT_FILE_MAX_CHARACTERS: 4000,
    }
}));


test('fileReferenceToString formats file references correctly', () => {
    expect(fileReferenceToString({
        fileName: 'auth.ts'
    })).toBe('@file:{auth.ts}');

    expect(fileReferenceToString({
        fileName: 'auth.ts',
        range: {
            startLine: 45,
            endLine: 60,
        }
    })).toBe('@file:{auth.ts:45-60}');
});

test('fileReferenceToString matches FILE_REFERENCE_REGEX', () => {
    expect(FILE_REFERENCE_REGEX.test(fileReferenceToString({
        fileName: 'auth.ts'
    }))).toBe(true);

    FILE_REFERENCE_REGEX.lastIndex = 0;
    expect(FILE_REFERENCE_REGEX.test(fileReferenceToString({
        fileName: 'auth.ts',
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

test('repairCitations fixes missing colon after @file', () => {
    const input = 'See the function in @file{auth.ts} for details.';
    const expected = 'See the function in @file:{auth.ts} for details.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations fixes missing colon with range', () => {
    const input = 'Check @file{config.ts:15-20} for the configuration.';
    const expected = 'Check @file:{config.ts:15-20} for the configuration.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations fixes missing braces around filename', () => {
    const input = 'The logic is in @file:utils.js and handles validation.';
    const expected = 'The logic is in @file:{utils.js} and handles validation.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations fixes missing braces with path', () => {
    const input = 'Look at @file:src/components/Button.tsx for the component.';
    const expected = 'Look at @file:{src/components/Button.tsx} for the component.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations removes multiple ranges keeping only first', () => {
    const input = 'See @file:{service.ts:10-15,20-25,30-35} for implementation.';
    const expected = 'See @file:{service.ts:10-15} for implementation.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations fixes malformed triple number ranges', () => {
    const input = 'Check @file:{handler.ts:5-10-15} for the logic.';
    const expected = 'Check @file:{handler.ts:5-10} for the logic.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations handles multiple citations in same text', () => {
    const input = 'See @file{auth.ts} and @file:config.js for setup details.';
    const expected = 'See @file:{auth.ts} and @file:{config.js} for setup details.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations leaves correctly formatted citations unchanged', () => {
    const input = 'The function @file:{utils.ts:42-50} handles validation correctly.';
    expect(repairCitations(input)).toBe(input);
});

test('repairCitations handles edge cases with spaces and punctuation', () => {
    const input = 'Functions like @file:helper.ts, @file{main.js}, and @file:{app.ts:1-5,10-15} work.';
    const expected = 'Functions like @file:{helper.ts}, @file:{main.js}, and @file:{app.ts:1-5} work.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations returns empty string unchanged', () => {
    expect(repairCitations('')).toBe('');
});

test('repairCitations returns text without citations unchanged', () => {
    const input = 'This is just regular text without any file references.';
    expect(repairCitations(input)).toBe(input);
});

test('repairCitations handles complex file paths correctly', () => {
    const input = 'Check @file:src/components/ui/Button/index.tsx for implementation.';
    const expected = 'Check @file:{src/components/ui/Button/index.tsx} for implementation.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations handles files with numbers and special characters', () => {
    const input = 'See @file{utils-v2.0.1.ts} and @file:config_2024.json for setup.';
    const expected = 'See @file:{utils-v2.0.1.ts} and @file:{config_2024.json} for setup.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations handles citation at end of sentence', () => {
    const input = 'The implementation is in @file:helper.ts.';
    const expected = 'The implementation is in @file:{helper.ts}.';
    expect(repairCitations(input)).toBe(expected);
});

test('repairCitations preserves already correct citations with ranges', () => {
    const input = 'The function @file:{utils.ts:10-20} and variable @file:{config.js:5} work correctly.';
    expect(repairCitations(input)).toBe(input);
});
