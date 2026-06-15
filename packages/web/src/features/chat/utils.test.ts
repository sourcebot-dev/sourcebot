import { expect, test, describe, vi } from 'vitest'
import { createUIMessage, fileReferenceToString, getAnswerPartFromAssistantMessage, getLastStepParts, getTurnProgressState, getUserMessageText, groupMessageIntoSteps, repairReferences, slateContentToString } from './utils'
import { FILE_REFERENCE_REGEX, ANSWER_TAG } from './constants';
import { SBChatMessage, SBChatMessagePart } from './types';
import type { Descendant } from 'slate';

// Mock the env module
vi.mock('@sourcebot/shared', () => ({
    env: {
        SOURCEBOT_CHAT_FILE_MAX_CHARACTERS: 4000,
    }
}));

const createAssistantMessage = (parts: SBChatMessagePart[]): SBChatMessage => ({
    id: 'assistant-message',
    role: 'assistant',
    parts,
});

const createUserMessage = (): SBChatMessage => ({
    id: 'user-message',
    role: 'user',
    parts: [
        {
            type: 'text',
            text: 'Hello',
        },
    ],
});

const dynamicApprovalRequestedPart = {
    type: 'dynamic-tool',
    toolName: 'mcp_linear__save_issue',
    toolCallId: 'tool-call-1',
    state: 'approval-requested',
    input: { title: 'Issue' },
    approval: { id: 'approval-1' },
} satisfies SBChatMessagePart;

const dynamicApprovalRespondedPart = {
    type: 'dynamic-tool',
    toolName: 'mcp_linear__save_issue',
    toolCallId: 'tool-call-1',
    state: 'approval-responded',
    input: { title: 'Issue' },
    approval: { id: 'approval-1', approved: true },
} satisfies SBChatMessagePart;

const listReposInput = {
    sort: 'name',
    page: 1,
    perPage: 30,
    direction: 'asc',
} as const;

const listReposOutput = {
    output: 'Done',
    metadata: {
        repos: [],
        totalCount: 0,
    },
};

const staticApprovalRequestedPart = {
    type: 'tool-list_repos',
    toolCallId: 'tool-call-2',
    state: 'approval-requested',
    input: listReposInput,
    approval: { id: 'approval-2' },
} satisfies SBChatMessagePart;

const staticApprovalRespondedPart = {
    type: 'tool-list_repos',
    toolCallId: 'tool-call-2',
    state: 'approval-responded',
    input: listReposInput,
    approval: { id: 'approval-2', approved: true },
} satisfies SBChatMessagePart;

const outputAvailablePart = {
    type: 'tool-list_repos',
    toolCallId: 'tool-call-3',
    state: 'output-available',
    input: listReposInput,
    output: listReposOutput,
} satisfies SBChatMessagePart;

const outputErrorPart = {
    type: 'tool-list_repos',
    toolCallId: 'tool-call-5',
    state: 'output-error',
    input: listReposInput,
    errorText: 'Tool failed',
} satisfies SBChatMessagePart;

const inputAvailablePart = {
    type: 'tool-list_repos',
    toolCallId: 'tool-call-4',
    state: 'input-available',
    input: listReposInput,
} satisfies SBChatMessagePart;


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

test('slateContentToString serializes command mentions as literal slash commands', () => {
    const children = [{
        type: 'paragraph',
        children: [
            {
                type: 'mention',
                data: {
                    type: 'command',
                    commandId: 'skill-1',
                    sourceId: 'personal-skill',
                    slug: 'review-pr',
                    name: 'Review PR',
                },
                children: [{ text: '' }],
            },
            { text: ' focus on auth changes' },
        ],
    }] satisfies Descendant[];

    expect(slateContentToString(children)).toBe('/review-pr focus on auth changes\n');
});

test('slateContentToString separates command mentions from adjacent text without doubling spaces', () => {
    const commandMention = {
        type: 'mention' as const,
        data: {
            type: 'command' as const,
            commandId: 'skill-1',
            sourceId: 'personal-skill',
            slug: 'review-pr',
            name: 'Review PR',
        },
        children: [{ text: '' }],
    };

    expect(slateContentToString([{
        type: 'paragraph',
        children: [
            commandMention,
            { text: 'focus on auth changes' },
        ],
    }])).toBe('/review-pr focus on auth changes\n');

    expect(slateContentToString([{
        type: 'paragraph',
        children: [
            commandMention,
            { text: ' focus on auth changes' },
        ],
    }])).toBe('/review-pr focus on auth changes\n');
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

test('getLastStepParts returns the last grouped step', () => {
    const parts: SBChatMessagePart[] = [
        {
            type: 'step-start',
        },
        {
            type: 'text',
            text: 'First step',
        },
        {
            type: 'step-start',
        },
        {
            type: 'text',
            text: 'Last step',
        },
    ];

    const lastStep = getLastStepParts(parts);

    expect(lastStep).toEqual([
        {
            type: 'step-start',
        },
        {
            type: 'text',
            text: 'Last step',
        },
    ]);
});

test('getTurnProgressState treats submitted and streaming as in progress and navigation guarded', () => {
    expect(getTurnProgressState({ messages: [createUserMessage()], status: 'submitted' })).toMatchObject({
        isNetworkActive: true,
        isTurnInProgress: true,
        shouldGuardNavigation: true,
    });
    expect(getTurnProgressState({ messages: [createUserMessage()], status: 'streaming' })).toMatchObject({
        isNetworkActive: true,
        isTurnInProgress: true,
        shouldGuardNavigation: true,
    });
});

test('getTurnProgressState returns idle for no messages and latest user message when ready', () => {
    expect(getTurnProgressState({ messages: [], status: 'ready' })).toMatchObject({
        isNetworkActive: false,
        isTurnInProgress: false,
        shouldGuardNavigation: false,
    });
    expect(getTurnProgressState({ messages: [createUserMessage()], status: 'ready' })).toMatchObject({
        isNetworkActive: false,
        isTurnInProgress: false,
        shouldGuardNavigation: false,
    });
});

test('getTurnProgressState treats latest-step approval-requested as awaiting approval but not navigation guarded', () => {
    const message = createAssistantMessage([
        {
            type: 'step-start',
        },
        dynamicApprovalRequestedPart,
    ]);

    expect(getTurnProgressState({ messages: [createUserMessage(), message], status: 'ready' })).toMatchObject({
        hasPendingToolApproval: true,
        isAwaitingToolApproval: true,
        isTurnInProgress: true,
        shouldGuardNavigation: false,
    });
});

test('getTurnProgressState treats approval continuation readiness as in progress and navigation guarded', () => {
    const message = createAssistantMessage([
        {
            type: 'step-start',
        },
        dynamicApprovalRespondedPart,
        outputAvailablePart,
    ]);

    expect(getTurnProgressState({ messages: [createUserMessage(), message], status: 'ready' })).toMatchObject({
        hasApprovalContinuationReady: true,
        isAwaitingToolApproval: false,
        isTurnInProgress: true,
        shouldGuardNavigation: true,
    });
});

test('getTurnProgressState treats approval-responded and output-error as continuation-ready', () => {
    const message = createAssistantMessage([
        {
            type: 'step-start',
        },
        dynamicApprovalRespondedPart,
        outputErrorPart,
    ]);

    expect(getTurnProgressState({ messages: [createUserMessage(), message], status: 'ready' })).toMatchObject({
        hasApprovalContinuationReady: true,
        isTurnInProgress: true,
        shouldGuardNavigation: true,
    });
});

test('getTurnProgressState does not treat a responded approval with non-terminal tools as continuation-ready', () => {
    const message = createAssistantMessage([
        {
            type: 'step-start',
        },
        dynamicApprovalRespondedPart,
        inputAvailablePart,
    ]);

    expect(getTurnProgressState({ messages: [createUserMessage(), message], status: 'ready' })).toMatchObject({
        hasApprovalContinuationReady: false,
        isTurnInProgress: false,
        shouldGuardNavigation: false,
    });
});

test('getTurnProgressState does not keep terminal tool states in progress', () => {
    const message = createAssistantMessage([
        {
            type: 'step-start',
        },
        outputAvailablePart,
    ]);

    expect(getTurnProgressState({ messages: [createUserMessage(), message], status: 'ready' })).toMatchObject({
        hasPendingToolApproval: false,
        hasApprovalContinuationReady: false,
        isTurnInProgress: false,
    });
});

test('getTurnProgressState treats error as not in progress even with pending approval', () => {
    const message = createAssistantMessage([
        {
            type: 'step-start',
        },
        dynamicApprovalRequestedPart,
    ]);

    expect(getTurnProgressState({ messages: [createUserMessage(), message], status: 'error' })).toMatchObject({
        hasPendingToolApproval: true,
        isTurnInProgress: false,
        shouldGuardNavigation: false,
    });
});

test('getTurnProgressState ignores approvals in older messages and older steps', () => {
    const olderMessage = createAssistantMessage([
        {
            type: 'step-start',
        },
        dynamicApprovalRequestedPart,
    ]);
    const latestMessage = createAssistantMessage([
        {
            type: 'step-start',
        },
        dynamicApprovalRequestedPart,
        {
            type: 'step-start',
        },
        {
            type: 'text',
            text: 'Later step',
        },
    ]);

    expect(getTurnProgressState({ messages: [createUserMessage(), olderMessage, createUserMessage()], status: 'ready' })).toMatchObject({
        isTurnInProgress: false,
    });
    expect(getTurnProgressState({ messages: [createUserMessage(), latestMessage], status: 'ready' })).toMatchObject({
        isTurnInProgress: false,
    });
});

test('getTurnProgressState classifies dynamic and static tool approvals', () => {
    expect(getTurnProgressState({
        messages: [createAssistantMessage([dynamicApprovalRequestedPart])],
        status: 'ready',
    })).toMatchObject({
        hasPendingToolApproval: true,
        isAwaitingToolApproval: true,
    });
    expect(getTurnProgressState({
        messages: [createAssistantMessage([staticApprovalRequestedPart])],
        status: 'ready',
    })).toMatchObject({
        hasPendingToolApproval: true,
        isAwaitingToolApproval: true,
    });
    expect(getTurnProgressState({
        messages: [createAssistantMessage([staticApprovalRespondedPart])],
        status: 'ready',
    })).toMatchObject({
        hasApprovalContinuationReady: true,
        shouldGuardNavigation: true,
    });
});

test('getAnswerPartFromAssistantMessage returns text part when it starts with ANSWER_TAG while turn is complete', () => {
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
        text: `This is the answer to your question.`
    });
});

test('getAnswerPartFromAssistantMessage returns text part when it starts with ANSWER_TAG while turn is in progress', () => {
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
        text: `This is the answer to your question.`
    });
});

test('getAnswerPartFromAssistantMessage returns last text part as fallback when turn is complete and no ANSWER_TAG', () => {
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

test('getAnswerPartFromAssistantMessage returns undefined when turn is in progress and no ANSWER_TAG', () => {
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

describe('getUserMessageText', () => {
    test('returns the text when the text part is first', () => {
        const message: SBChatMessage = {
            role: 'user',
            parts: [
                {
                    type: 'text',
                    text: 'Hello, world!',
                },
            ],
        } as SBChatMessage;

        expect(getUserMessageText(message)).toBe('Hello, world!');
    });

    test('returns the text when a non-text part precedes the text part', () => {
        const message: SBChatMessage = {
            role: 'user',
            parts: [
                {
                    type: 'data-source',
                    data: {
                        type: 'file',
                        path: 'auth.ts',
                        repo: 'github.com/sourcebot-dev/sourcebot',
                        name: 'auth.ts',
                        revision: 'main',
                    },
                },
                {
                    type: 'text',
                    text: 'Explain this file',
                },
            ],
        } as SBChatMessage;

        expect(getUserMessageText(message)).toBe('Explain this file');
    });

    test('returns an empty string when there is no text part', () => {
        const message: SBChatMessage = {
            role: 'user',
            parts: [
                {
                    type: 'data-source',
                    data: {
                        type: 'file',
                        path: 'auth.ts',
                        repo: 'github.com/sourcebot-dev/sourcebot',
                        name: 'auth.ts',
                        revision: 'main',
                    },
                },
            ],
        } as SBChatMessage;

        expect(getUserMessageText(message)).toBe('');
    });

    test('returns an empty string when there are no parts', () => {
        const message: SBChatMessage = {
            role: 'user',
            parts: [],
        } as unknown as SBChatMessage;

        expect(getUserMessageText(message)).toBe('');
    });
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

describe('createUIMessage', () => {
    test('includes disabledMcpServerIds in metadata when provided', () => {
        const result = createUIMessage('hello', [], [], ['server1', 'server2']);

        expect(result.metadata?.disabledMcpServerIds).toEqual(['server1', 'server2']);
    });

    test('defaults disabledMcpServerIds to empty array when omitted', () => {
        const result = createUIMessage('hello', [], []);

        expect(result.metadata?.disabledMcpServerIds).toEqual([]);
    });

    test('passes through empty array', () => {
        const result = createUIMessage('hello', [], [], []);

        expect(result.metadata?.disabledMcpServerIds).toEqual([]);
    });

    test('includes both selectedSearchScopes and disabledMcpServerIds in metadata', () => {
        const scopes = [{ type: 'repo' as const, value: 'org/repo', name: 'repo', codeHostType: 'github' }];
        const result = createUIMessage('hello', [], scopes, ['disabled1']);

        expect(result.metadata?.selectedSearchScopes).toEqual(scopes);
        expect(result.metadata?.disabledMcpServerIds).toEqual(['disabled1']);
    });

    test('does not convert command mentions into sources', () => {
        const result = createUIMessage('hello', [{
            type: 'command',
            commandId: 'skill-1',
            sourceId: 'personal-skill',
            slug: 'review-pr',
            name: 'Review PR',
        }], [], []);

        expect(result.parts).toEqual([{
            type: 'text',
            text: 'hello',
        }]);
    });
});
