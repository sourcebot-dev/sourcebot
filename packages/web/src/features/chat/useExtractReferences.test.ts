import { expect, test } from 'vitest'
import { SBChatMessage } from './types';
import { renderHook } from '@testing-library/react-hooks';
import { useExtractReferences } from './useExtractReferences';
import { getFileReferenceId } from './utils';

test('useExtractReferences extracts file references from text content', () => {
    const message: SBChatMessage = {
        id: 'msg1',
        role: 'assistant',
        parts: [
                {
                    type: 'text',
                    text: 'The auth flow is implemented in @file:{github.com/sourcebot-dev/sourcebot::auth.ts} and uses sessions @file:{github.com/sourcebot-dev/sourcebot::auth.ts:45-60}.'
                }
        ]
    };

    const { result } = renderHook(() => useExtractReferences(message));

    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toMatchObject({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'auth.ts',
        id: getFileReferenceId({ repo: 'github.com/sourcebot-dev/sourcebot', path: 'auth.ts' }),
        type: 'file',
    });

    expect(result.current[1]).toMatchObject({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'auth.ts',
        id: getFileReferenceId({
            repo: 'github.com/sourcebot-dev/sourcebot',
            path: 'auth.ts',
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
                    text: 'The auth flow is implemented in @file:{github.com/sourcebot-dev/sourcebot::auth.ts} and uses sessions @file:{github.com/sourcebot-dev/sourcebot::auth.ts:45-60}.'
                }
        ]
    };

    const { result } = renderHook(() => useExtractReferences(message));

    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toMatchObject({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'auth.ts',
        id: getFileReferenceId({ repo: 'github.com/sourcebot-dev/sourcebot', path: 'auth.ts' }),
        type: 'file',
    });

    expect(result.current[1]).toMatchObject({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'auth.ts',
        id: getFileReferenceId({
            repo: 'github.com/sourcebot-dev/sourcebot',
            path: 'auth.ts',
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
                text: 'The auth flow is implemented in @file:{github.com/sourcebot-dev/sourcebot::auth.ts}.'
            },
            {
                type: 'reasoning',
                text: 'We need to check the session handling in @file:{github.com/sourcebot-dev/sourcebot::session.ts:10-20}.'
            },
            {
                type: 'text',
                text: 'The configuration is stored in @file:{github.com/sourcebot-dev/sourcebot::config.json} and @file:{github.com/sourcebot-dev/sourcebot::utils.ts:5}.'
            }
        ]
    };

    const { result } = renderHook(() => useExtractReferences(message));

    expect(result.current).toHaveLength(4);
    
    // From text part
    expect(result.current[0]).toMatchObject({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'auth.ts',
        id: getFileReferenceId({ repo: 'github.com/sourcebot-dev/sourcebot', path: 'auth.ts' }),
        type: 'file',
    });

    // From reasoning part
    expect(result.current[1]).toMatchObject({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'session.ts',
        id: getFileReferenceId({
            repo: 'github.com/sourcebot-dev/sourcebot',
            path: 'session.ts',
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

    expect(result.current[2]).toMatchObject({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'config.json',
        id: getFileReferenceId({ repo: 'github.com/sourcebot-dev/sourcebot', path: 'config.json' }),
        type: 'file',
    });

    expect(result.current[3]).toMatchObject({
        repo: 'github.com/sourcebot-dev/sourcebot',
        path: 'utils.ts',
        id: getFileReferenceId({
            repo: 'github.com/sourcebot-dev/sourcebot',
            path: 'utils.ts',
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
