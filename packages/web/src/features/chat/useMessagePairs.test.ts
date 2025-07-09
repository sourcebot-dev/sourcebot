import { expect, test } from 'vitest'
import { SBChatMessage } from './types';
import { useMessagePairs } from './useMessagePairs';
import { renderHook } from '@testing-library/react-hooks';

test('useMessagePairs pairs user and assistant messages', () => {
    const userMessage: SBChatMessage = {
        role: 'user', parts: [],
        id: '0'
    }

    const assistantMessage: SBChatMessage = {
        role: 'assistant', parts: [],
        id: '1'
    }

    const messages: SBChatMessage[] = [
        userMessage,
        assistantMessage,
    ]

    const pairs = renderHook(() => useMessagePairs(messages));

    expect(pairs.result.current).toEqual([
        [userMessage, assistantMessage],
    ]);

});

test('pairMessages pairs orphaned user messages with undefined', () => {
    const userMessage1: SBChatMessage = {
        role: 'user', parts: [],
        id: '0'
    }

    const userMessage2: SBChatMessage = {
        role: 'user', parts: [],
        id: '1'
    }

    const assistantMessage: SBChatMessage = {
        role: 'assistant', parts: [],
        id: '2'
    }

    const messages: SBChatMessage[] = [
        userMessage1,
        userMessage2,
        assistantMessage,
    ]

    const pairs = renderHook(() => useMessagePairs(messages));

    expect(pairs.result.current).toEqual([
        [userMessage1, undefined],
        [userMessage2, assistantMessage],
    ]);
});

test('pairMessages ignores orphaned assistant messages', () => {
    const userMessage: SBChatMessage = {
        role: 'user', parts: [],
        id: '0'
    }

    const assistantMessage1: SBChatMessage = {
        role: 'assistant', parts: [],
        id: '1'
    }

    const assistantMessage2: SBChatMessage = {
        role: 'assistant', parts: [],
        id: '2'
    }

    const messages: SBChatMessage[] = [
        userMessage,
        assistantMessage1,
        assistantMessage2,
    ]

    const pairs = renderHook(() => useMessagePairs(messages));

    expect(pairs.result.current).toEqual([
        [userMessage, assistantMessage1],
    ]);
})

test('pairMessages pairs the last message with undefined if it is a user message', () => {
    const userMessage1: SBChatMessage = {
        role: 'user', parts: [],
        id: '0'
    }

    const assistantMessage: SBChatMessage = {
        role: 'assistant', parts: [],
        id: '2'
    }

    const userMessage2: SBChatMessage = {
        role: 'user', parts: [],
        id: '1'
    }

    const messages: SBChatMessage[] = [
        userMessage1,
        assistantMessage,
        userMessage2,
    ]

    const pairs = renderHook(() => useMessagePairs(messages));

    expect(pairs.result.current).toEqual([
        [userMessage1, assistantMessage],
        [userMessage2, undefined],
    ]);
})