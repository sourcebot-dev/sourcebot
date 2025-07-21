import { expect, test, vi } from 'vitest'
import { fileReferenceToString, getAnswerPartFromAssistantMessage, groupMessageIntoSteps, sourceCodeChunksToModelOutput, sourceCodeToModelOutput } from './utils'
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

test('sourceCodeToModelOutput adds line numbers correctly', () => {
    const source = 'function hello() {\n  return "world";\n}';
    const result = sourceCodeToModelOutput(source);
    
    expect(result.output).toBe('1:function hello() {\n2:  return "world";\n3:}');
    expect(result.isTruncated).toBe(false);
});

test('sourceCodeToModelOutput respects lineOffset parameter', () => {
    const source = 'const x = 1;\nconst y = 2;';
    const result = sourceCodeToModelOutput(source, { lineOffset: 10 });
    
    expect(result.output).toBe('10:const x = 1;\n11:const y = 2;');
    expect(result.isTruncated).toBe(false);
});

test('sourceCodeToModelOutput handles empty string', () => {
    const source = '';
    const result = sourceCodeToModelOutput(source);
    
    expect(result.output).toBe('1:');
    expect(result.isTruncated).toBe(false);
});

test('sourceCodeToModelOutput handles single line', () => {
    const source = 'console.log("hello");';
    const result = sourceCodeToModelOutput(source);
    
    expect(result.output).toBe('1:console.log("hello");');
    expect(result.isTruncated).toBe(false);
});

test('sourceCodeToModelOutput truncates when exceeding max characters', () => {
    const source = 'a'.repeat(4000);
    const { output, isTruncated } = sourceCodeToModelOutput(source);

    expect(isTruncated).toBe(true);
    expect(output).toEqual(`1:${'a'.repeat(3998)}`); // -2 for "1:" prefix
})

test('sourceCodeToModelOutput truncates when exceeding max character and there is an accumulator', () => {
    const accum = 1000;
    const source = 'a'.repeat(3000);
    const { output, isTruncated } = sourceCodeToModelOutput(source, { charAccum: accum });

    // output would normally be 3000 + 2 = 3002 characters.
    // 3002 + 1000 = 4002 characters > 4000 limit.
    // so truncate to 4000 - 1000 = 3000 characters.
    // => 2998 'a's

    expect(isTruncated).toBe(true);
    expect(output).toEqual(`1:${'a'.repeat(2998)}`); // -2 for "1:" prefix
    expect(accum + output.length).toBe(4000);
});

test('sourceCodeChunksToModelOutput truncates chunks when exceeding max characters', () => {
    const chunks = [
        {
            source: 'a'.repeat(998),
            startLine: 1
        },
        {
            source: 'b'.repeat(998),
            startLine: 2
        },
        {
            source: 'c'.repeat(998),
            startLine: 3
        },
        {
            source: 'd'.repeat(998),
            startLine: 4
        },
        // At this point, the accumulator is 4000 characters.
        // So all of the next chunk will be truncated.
        {
            source: 'e'.repeat(998),
            startLine: 5
        }
    ]

    const output = sourceCodeChunksToModelOutput(chunks);

    expect(output[0].output).toEqual(`1:${'a'.repeat(998)}`);
    expect(output[0].isTruncated).toBe(false);

    expect(output[1].output).toEqual(`2:${'b'.repeat(998)}`);
    expect(output[1].isTruncated).toBe(false);

    expect(output[2].output).toEqual(`3:${'c'.repeat(998)}`);
    expect(output[2].isTruncated).toBe(false);

    expect(output[3].output).toEqual(`4:${'d'.repeat(998)}`);
    expect(output[3].isTruncated).toBe(false);

    expect(output[4].output).toEqual('');
    expect(output[4].isTruncated).toBe(true);
});

test('sourceCodeChunksToModelOutput handles chunks with different start lines correctly', () => {
    const chunks = [
        {
            source: 'line1\nline2',
            startLine: 42
        },
        {
            source: 'another\nset\nof\nlines',
            startLine: 100
        }
    ];
    
    const result = sourceCodeChunksToModelOutput(chunks);
    
    expect(result).toHaveLength(2);
    expect(result[0].output).toBe('42:line1\n43:line2');
    expect(result[1].output).toBe('100:another\n101:set\n102:of\n103:lines');
});

test('sourceCodeChunksToModelOutput returns empty array for empty input', () => {
    const result = sourceCodeChunksToModelOutput([]);
    expect(result).toHaveLength(0);
});

test('sourceCodeChunksToModelOutput handles single line chunks', () => {
    const chunks = [
        {
            source: 'const a = 1;',
            startLine: 10
        },
        {
            source: 'const b = 2;',
            startLine: 15
        }
    ];
    
    const result = sourceCodeChunksToModelOutput(chunks);
    
    expect(result).toHaveLength(2);
    expect(result[0].output).toBe('10:const a = 1;');
    expect(result[1].output).toBe('15:const b = 2;');
    expect(result[0].isTruncated).toBe(false);
    expect(result[1].isTruncated).toBe(false);
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
