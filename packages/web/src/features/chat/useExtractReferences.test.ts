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
        id: getFileReferenceId('auth.ts'),
        type: 'file',
    });

    expect(result.current[1]).toMatchObject({
        fileName: 'auth.ts',
        id: getFileReferenceId('auth.ts', {
            startLine: 45,
            endLine: 60,
        }),
        type: 'file',
        range: {
            startLine: 45,
            endLine: 60,
        }
    });
});