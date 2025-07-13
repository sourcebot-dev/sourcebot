import { expect, test } from 'vitest'
import { SBChatMessage } from './types';
import { renderHook } from '@testing-library/react-hooks';
import { useExtractReferences } from './useExtractReferences';
import { getFileReferenceId } from './utils';

test('useExtractReferences extracts file references from answer tool content', () => {
    const message: SBChatMessage = {
        id: 'msg1',
        role: 'assistant',
        parts: [
                {
                    type: 'tool-answerTool',
                    toolCallId: 'test-id',
                    state: 'input-available',
                    input: {
                        answer: 'The auth flow is implemented in @file:{auth.ts} and uses sessions @file:{auth.ts:45-60}.'
                    },
                }
        ]
    };

    const { result } = renderHook(() => useExtractReferences(message));

    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toMatchObject({
        fileName: 'auth.ts',
        id: getFileReferenceId({ fileName: 'auth.ts' }),
        type: 'file',
    });

    expect(result.current[1]).toMatchObject({
        fileName: 'auth.ts',
        id: getFileReferenceId({
            fileName: 'auth.ts',
            range: {
                startLine: 45,
                endLine: 60,
            }
        }),
        type: 'file',
        range: {
            startLine: 45,
            endLine: 60,
        }
    });
});

test('useExtractReferences extracts file references from text content', () => {
    const message: SBChatMessage = {
        id: 'msg1',
        role: 'assistant',
        parts: [
                {
                    type: 'text',
                    text: 'The auth flow is implemented in @file:{auth.ts} and uses sessions @file:{auth.ts:45-60}.'
                }
        ]
    };

    const { result } = renderHook(() => useExtractReferences(message));

    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toMatchObject({
        fileName: 'auth.ts',
        id: getFileReferenceId({ fileName: 'auth.ts' }),
        type: 'file',
    });

    expect(result.current[1]).toMatchObject({
        fileName: 'auth.ts',
        id: getFileReferenceId({
            fileName: 'auth.ts',
            range: {
                startLine: 45,
                endLine: 60,
            }
        }),
        type: 'file',
        range: {
            startLine: 45,
            endLine: 60,
        }
    });
});

test('useExtractReferences extracts file references from reasoning content', () => {
    const message: SBChatMessage = {
        id: 'msg1',
        role: 'assistant',
        parts: [
                {
                    type: 'reasoning',
                    text: 'The auth flow is implemented in @file:{auth.ts} and uses sessions @file:{auth.ts:45-60}.'
                }
        ]
    };

    const { result } = renderHook(() => useExtractReferences(message));

    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toMatchObject({
        fileName: 'auth.ts',
        id: getFileReferenceId({ fileName: 'auth.ts' }),
        type: 'file',
    });

    expect(result.current[1]).toMatchObject({
        fileName: 'auth.ts',
        id: getFileReferenceId({
            fileName: 'auth.ts',
            range: {
                startLine: 45,
                endLine: 60,
            }
        }),
        type: 'file',
        range: {
            startLine: 45,
            endLine: 60,
        }
    });
});

test('useExtractReferences extracts file references from multi-part', () => {
    const message: SBChatMessage = {
        id: 'msg1',
        role: 'assistant',
        parts: [
            {
                type: 'text',
                text: 'The auth flow is implemented in @file:{auth.ts}.'
            },
            {
                type: 'reasoning',
                text: 'We need to check the session handling in @file:{session.ts:10-20}.'
            },
            {
                type: 'tool-answerTool',
                toolCallId: 'test-id',
                state: 'input-available',
                input: {
                    answer: 'The configuration is stored in @file:{config.json} and @file:{utils.ts:5}.'
                },
            }
        ]
    };

    const { result } = renderHook(() => useExtractReferences(message));

    expect(result.current).toHaveLength(4);
    
    // From text part
    expect(result.current[0]).toMatchObject({
        fileName: 'auth.ts',
        id: getFileReferenceId({ fileName: 'auth.ts' }),
        type: 'file',
    });

    // From reasoning part
    expect(result.current[1]).toMatchObject({
        fileName: 'session.ts',
        id: getFileReferenceId({
            fileName: 'session.ts',
            range: {
                startLine: 10,
                endLine: 20,
            }
        }),
        type: 'file',
        range: {
            startLine: 10,
            endLine: 20,
        }
    });

    // From tool-answerTool part
    expect(result.current[2]).toMatchObject({
        fileName: 'config.json',
        id: getFileReferenceId({ fileName: 'config.json' }),
        type: 'file',
    });

    expect(result.current[3]).toMatchObject({
        fileName: 'utils.ts',
        id: getFileReferenceId({
            fileName: 'utils.ts',
            range: {
                startLine: 5,
                endLine: 5,
            }
        }),
        type: 'file',
        range: {
            startLine: 5,
            endLine: 5,
        }
    });
});
