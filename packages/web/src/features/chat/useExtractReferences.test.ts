import { expect, test } from 'vitest'
import { renderHook } from '@testing-library/react-hooks';
import { useExtractReferences } from './useExtractReferences';
import { getFileReferenceId } from './utils';
import { TextUIPart } from 'ai';

test('useExtractReferences extracts file references from text content', () => {
    const part: TextUIPart = {
        type: 'text',
        text: 'The auth flow is implemented in @file:{github.com/sourcebot-dev/sourcebot::auth.ts} and uses sessions @file:{github.com/sourcebot-dev/sourcebot::auth.ts:45-60}.'
    }

    const { result } = renderHook(() => useExtractReferences(part));

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
