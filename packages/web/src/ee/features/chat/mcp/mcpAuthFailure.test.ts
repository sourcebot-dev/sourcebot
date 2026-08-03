import { UnauthorizedError } from '@ai-sdk/mcp';
import { describe, expect, test } from 'vitest';
import { SBChatMessage } from '@/features/chat/types';
import {
    createMcpAuthInterruptionDirective,
    createMcpAuthRequiredToolErrorText,
    denyApprovedToolApprovalsForAuthInterruption,
    getMcpAuthRequiredFailureFromAssistantMessage,
    getMcpAuthRequiredServerNameFromErrorText,
    isMcpAuthRequiredToolErrorText,
    isReconnectRequiredMcpAuthFailure,
    McpAuthRequiredError,
} from './mcpAuthFailure';

describe('isReconnectRequiredMcpAuthFailure', () => {
    test('classifies an UnauthorizedError from the MCP SDK as reconnectable', () => {
        expect(isReconnectRequiredMcpAuthFailure(new UnauthorizedError('Unauthorized'))).toBe(true);
    });

    test('classifies a 401 response as reconnectable', () => {
        const error = Object.assign(new Error('HTTP 401'), { statusCode: 401 });
        expect(isReconnectRequiredMcpAuthFailure(error)).toBe(true);
    });

    test('classifies a nested response status of 401 as reconnectable', () => {
        const error = Object.assign(new Error('request failed'), { response: { status: 401 } });
        expect(isReconnectRequiredMcpAuthFailure(error)).toBe(true);
    });

    test('classifies invalid_grant as reconnectable even with the token endpoint 400 status', () => {
        const error = Object.assign(new Error('Token refresh failed: invalid_grant'), {
            error: 'invalid_grant',
            statusCode: 400,
        });
        expect(isReconnectRequiredMcpAuthFailure(error)).toBe(true);
    });

    test('classifies an invalid_grant mention in the message as reconnectable', () => {
        expect(isReconnectRequiredMcpAuthFailure(new Error('server responded with invalid_grant'))).toBe(true);
    });

    test('does not classify a 403 that still carries its status as reconnectable', () => {
        const error = Object.assign(new Error('Forbidden'), { statusCode: 403 });
        expect(isReconnectRequiredMcpAuthFailure(error)).toBe(false);
    });

    test('does not classify an unauthorized-named error with a non-401 status as reconnectable', () => {
        const error = Object.assign(new Error('Forbidden'), { statusCode: 403 });
        error.name = 'UnauthorizedError';
        expect(isReconnectRequiredMcpAuthFailure(error)).toBe(false);
    });

    test('does not classify a 500 response as reconnectable', () => {
        const error = Object.assign(new Error('Internal server error'), { statusCode: 500 });
        expect(isReconnectRequiredMcpAuthFailure(error)).toBe(false);
    });

    test('does not classify a timeout as reconnectable', () => {
        expect(isReconnectRequiredMcpAuthFailure(new Error('MCP tool "mcp_linear__list_issues" timed out after 30000ms'))).toBe(false);
    });

    test('does not classify an abort as reconnectable', () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        expect(isReconnectRequiredMcpAuthFailure(error)).toBe(false);
    });

    test('does not classify a generic error or non-error value as reconnectable', () => {
        expect(isReconnectRequiredMcpAuthFailure(new Error('connection refused'))).toBe(false);
        expect(isReconnectRequiredMcpAuthFailure(undefined)).toBe(false);
        expect(isReconnectRequiredMcpAuthFailure('unauthorized')).toBe(false);
    });
});

describe('MCP auth-required tool error text', () => {
    test('round-trips the server name through the marker text', () => {
        const text = createMcpAuthRequiredToolErrorText('Linear');
        expect(isMcpAuthRequiredToolErrorText(text)).toBe(true);
        expect(getMcpAuthRequiredServerNameFromErrorText(text)).toBe('Linear');
    });

    test('round-trips a server name containing quotes', () => {
        const text = createMcpAuthRequiredToolErrorText('My "Cool" Server');
        expect(getMcpAuthRequiredServerNameFromErrorText(text)).toBe('My "Cool" Server');
    });

    test('McpAuthRequiredError carries the marker text as its message', () => {
        const error = new McpAuthRequiredError('Linear');
        expect(isMcpAuthRequiredToolErrorText(error.message)).toBe(true);
        expect(getMcpAuthRequiredServerNameFromErrorText(error.message)).toBe('Linear');
    });

    test('rejects unrelated error text', () => {
        expect(isMcpAuthRequiredToolErrorText(undefined)).toBe(false);
        expect(isMcpAuthRequiredToolErrorText('Authentication required: token missing')).toBe(false);
        expect(getMcpAuthRequiredServerNameFromErrorText('some other failure')).toBeUndefined();
    });
});

const createAssistantMessage = (parts: SBChatMessage['parts']): SBChatMessage => ({
    id: 'assistant-1',
    role: 'assistant',
    parts,
});

describe('getMcpAuthRequiredFailureFromAssistantMessage', () => {
    test('detects the interruption from a marked tool error part', () => {
        const message = createAssistantMessage([
            { type: 'step-start' },
            {
                type: 'dynamic-tool',
                toolName: 'mcp_linear__list_issues',
                toolCallId: 'tool-call-1',
                state: 'output-error',
                input: {},
                errorText: createMcpAuthRequiredToolErrorText('Linear'),
            },
        ] as SBChatMessage['parts']);

        expect(getMcpAuthRequiredFailureFromAssistantMessage(message)).toEqual({ serverName: 'Linear' });
    });

    test('ignores unrelated tool errors and non-assistant messages', () => {
        const message = createAssistantMessage([
            {
                type: 'dynamic-tool',
                toolName: 'mcp_linear__list_issues',
                toolCallId: 'tool-call-1',
                state: 'output-error',
                input: {},
                errorText: 'HTTP 500: internal error',
            },
        ] as SBChatMessage['parts']);

        expect(getMcpAuthRequiredFailureFromAssistantMessage(message)).toBeUndefined();
        expect(getMcpAuthRequiredFailureFromAssistantMessage(undefined)).toBeUndefined();
        expect(getMcpAuthRequiredFailureFromAssistantMessage({
            id: 'user-1',
            role: 'user',
            parts: [{ type: 'text', text: 'hello' }],
        } as SBChatMessage)).toBeUndefined();
    });
});

describe('denyApprovedToolApprovalsForAuthInterruption', () => {
    test('rewrites approved approvals to denials and leaves everything else untouched', () => {
        const message = createAssistantMessage([
            {
                type: 'dynamic-tool',
                toolName: 'mcp_linear__save_comment',
                toolCallId: 'tool-call-1',
                state: 'approval-responded',
                input: {},
                approval: { id: 'approval-1', approved: true },
            },
            {
                type: 'dynamic-tool',
                toolName: 'mcp_linear__save_issue',
                toolCallId: 'tool-call-2',
                state: 'approval-responded',
                input: {},
                approval: { id: 'approval-2', approved: false, reason: 'User denied' },
            },
            {
                type: 'dynamic-tool',
                toolName: 'mcp_linear__list_issues',
                toolCallId: 'tool-call-3',
                state: 'output-available',
                input: {},
                output: {},
            },
        ] as SBChatMessage['parts']);

        const result = denyApprovedToolApprovalsForAuthInterruption(message, 'Linear');

        const [rewritten, alreadyDenied, unrelated] = result.parts;
        expect(rewritten).toMatchObject({
            state: 'approval-responded',
            approval: { id: 'approval-1', approved: false },
        });
        expect((rewritten as { approval: { reason?: string } }).approval.reason).toContain('Linear');
        expect(alreadyDenied).toBe(message.parts[1]);
        expect(unrelated).toBe(message.parts[2]);
        // The input message is not mutated.
        expect(message.parts[0]).toMatchObject({ approval: { approved: true } });
    });
});

describe('createMcpAuthInterruptionDirective', () => {
    test('names the failed connector and forbids further tool use', () => {
        const directive = createMcpAuthInterruptionDirective('Linear');
        expect(directive).toContain('Linear');
        expect(directive).toContain('Do not attempt any more tool calls');
    });
});
