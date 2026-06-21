import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DetailsCard } from './detailsCard';
import type { SBChatMessagePart } from '@/features/chat/types';

vi.mock('@/hooks/useCaptureEvent', () => ({
    default: () => vi.fn(),
}));

afterEach(() => {
    cleanup();
});

describe('DetailsCard', () => {
    test('shows an approval waiting state without final metadata while awaiting permission', () => {
        const { container } = render(
            <TooltipProvider>
                <DetailsCard
                    chatId="chat-id"
                    isExpanded={true}
                    onExpandedChanged={vi.fn()}
                    isThinking={false}
                    isTurnInProgress={true}
                    isNetworkActive={false}
                    isAwaitingToolApproval={true}
                    thinkingSteps={[]}
                    metadata={{
                        modelName: 'Claude Sonnet',
                        totalTokens: 41000,
                        totalResponseTimeMs: 13000,
                    }}
                />
            </TooltipProvider>
        );

        expect(screen.queryByText('Awaiting permission...')).toBeTruthy();
        expect(screen.queryByText('Thinking...')).toBeNull();
        expect(container.querySelector('.lucide-shield-question-mark')).toBeTruthy();
        expect(container.querySelector('.lucide-loader-circle')).toBeNull();
        expect(container.querySelector('.animate-spin')).toBeNull();
        expect(screen.queryByText('Claude Sonnet')).toBeNull();
        expect(screen.queryByText('41k tokens')).toBeNull();
    });

    test('shows a spinner while thinking instead of the approval waiting icon', () => {
        const { container } = render(
            <TooltipProvider>
                <DetailsCard
                    chatId="chat-id"
                    isExpanded={false}
                    onExpandedChanged={vi.fn()}
                    isThinking={true}
                    isTurnInProgress={true}
                    isNetworkActive={true}
                    isAwaitingToolApproval={false}
                    thinkingSteps={[]}
                />
            </TooltipProvider>
        );

        expect(screen.queryByText('Thinking...')).toBeTruthy();
        expect(screen.queryByText('Awaiting permission...')).toBeNull();
        expect(container.querySelector('.lucide-loader-circle')).toBeTruthy();
        expect(container.querySelector('.animate-spin')).toBeTruthy();
        expect(container.querySelector('.lucide-shield-question-mark')).toBeNull();
    });

    test('shows final details metadata only after the turn is complete', () => {
        render(
            <TooltipProvider>
                <DetailsCard
                    chatId="chat-id"
                    isExpanded={true}
                    onExpandedChanged={vi.fn()}
                    isThinking={false}
                    isTurnInProgress={false}
                    isNetworkActive={false}
                    isAwaitingToolApproval={false}
                    thinkingSteps={[]}
                    metadata={{
                        modelName: 'Claude Sonnet',
                        totalTokens: 41000,
                        totalResponseTimeMs: 13000,
                    }}
                />
            </TooltipProvider>
        );

        expect(screen.queryByText('Details')).toBeTruthy();
        expect(screen.queryByText('Claude Sonnet')).toBeTruthy();
        expect(screen.queryByText('41k tokens')).toBeTruthy();
    });

    test('shows terminal tool activation failures instead of a loading state', () => {
        const failedActivationPart = {
            type: 'tool-tool_request_activation',
            toolCallId: 'tool-call-1',
            state: 'output-error',
            input: { tool_to_activate_name: 'mcp_linear__search_issues' },
            errorText: 'Activation failed',
        } satisfies SBChatMessagePart;

        render(
            <TooltipProvider>
                <DetailsCard
                    chatId="chat-id"
                    isExpanded={true}
                    onExpandedChanged={vi.fn()}
                    isThinking={false}
                    isTurnInProgress={true}
                    isNetworkActive={false}
                    isAwaitingToolApproval={false}
                    thinkingSteps={[{ stepIndex: 0, parts: [failedActivationPart] }]}
                />
            </TooltipProvider>
        );

        expect(screen.queryByText('Tool activation failed: Activation failed')).toBeTruthy();
        expect(screen.queryByText('Activating tool...')).toBeNull();
    });
});
