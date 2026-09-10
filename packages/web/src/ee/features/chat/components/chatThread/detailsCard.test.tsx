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

    test('renders a list_branches result summary', () => {
        const listBranchesPart = {
            type: 'tool-list_branches',
            toolCallId: 'tool-call-branches',
            state: 'output-available',
            input: {
                repo: 'github.com/sourcebot-dev/sourcebot',
                page: 1,
                perPage: 2,
            },
            output: {
                output: '{"branches":[]}',
                metadata: {
                    repo: 'github.com/sourcebot-dev/sourcebot',
                    returnedCount: 2,
                    totalCount: 7,
                },
            },
        } satisfies SBChatMessagePart;

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
                    thinkingSteps={[{ stepIndex: 0, parts: [listBranchesPart] }]}
                />
            </TooltipProvider>
        );

        expect(screen.queryByText('github.com/sourcebot-dev/sourcebot')).toBeTruthy();
        expect(screen.queryByText('2 of 7 branches')).toBeTruthy();
    });

    test('renders a loaded skill as a tool call with its name and command', () => {
        const loadedSkillPart = {
            type: 'tool-load_skill',
            toolCallId: 'tool-call-1',
            state: 'output-available',
            input: { skill_id: 'skill-1' },
            output: {
                skill: { id: 'skill-1', slug: 'review-pr', name: 'Review PR' },
                instructions: 'Look for correctness issues first.',
            },
        } satisfies SBChatMessagePart;

        const { container } = render(
            <TooltipProvider>
                <DetailsCard
                    chatId="chat-id"
                    isExpanded={true}
                    onExpandedChanged={vi.fn()}
                    isThinking={false}
                    isTurnInProgress={false}
                    isNetworkActive={false}
                    isAwaitingToolApproval={false}
                    thinkingSteps={[{ stepIndex: 0, parts: [loadedSkillPart] }]}
                />
            </TooltipProvider>
        );

        expect(container.textContent).toContain('Loaded skill:');
        expect(container.textContent).toContain('Review PR');
        expect(container.textContent).toContain('/review-pr');
        expect(screen.queryByText('Loading skill...')).toBeNull();
        // Instructions live behind a collapsed details section.
        expect(screen.queryByText('Look for correctness issues first.')).toBeNull();
    });

    test('renders a create_skill success summary with the name and command', () => {
        const createSkillPart = {
            type: 'tool-create_skill',
            toolCallId: 'tool-call-create-skill',
            state: 'output-available',
            input: {
                name: 'Review PR',
                slug: 'review-pr',
                description: 'Review a pull request.',
                instructions: 'Look for correctness issues first.',
            },
            output: {
                output: '{}',
                metadata: {
                    id: 'skill-1',
                    slug: 'review-pr',
                    name: 'Review PR',
                    url: 'https://sourcebot.example.com/settings/skills?skill=skill-1',
                },
            },
        } satisfies SBChatMessagePart;

        const { container } = render(
            <TooltipProvider>
                <DetailsCard
                    chatId="chat-id"
                    isExpanded={true}
                    onExpandedChanged={vi.fn()}
                    isThinking={false}
                    isTurnInProgress={false}
                    isNetworkActive={false}
                    isAwaitingToolApproval={false}
                    thinkingSteps={[{ stepIndex: 0, parts: [createSkillPart] }]}
                />
            </TooltipProvider>
        );

        expect(container.textContent).toContain('Created skill');
        expect(container.textContent).toContain('Review PR');
        expect(container.textContent).toContain('/review-pr');
        expect(screen.queryByText('Creating skill...')).toBeNull();
    });

    test('renders an update_skill success summary with the name and command', () => {
        const updateSkillPart = {
            type: 'tool-update_skill',
            toolCallId: 'tool-call-update-skill',
            state: 'output-available',
            input: {
                slug: 'review-pr',
                scope: 'shared',
                name: 'Review PR v2',
            },
            output: {
                output: '{}',
                metadata: {
                    id: 'skill-1',
                    slug: 'review-pr',
                    name: 'Review PR v2',
                    scope: 'shared',
                    url: 'https://sourcebot.example.com/settings/skills?skill=skill-1',
                },
            },
        } satisfies SBChatMessagePart;

        const { container } = render(
            <TooltipProvider>
                <DetailsCard
                    chatId="chat-id"
                    isExpanded={true}
                    onExpandedChanged={vi.fn()}
                    isThinking={false}
                    isTurnInProgress={false}
                    isNetworkActive={false}
                    isAwaitingToolApproval={false}
                    thinkingSteps={[{ stepIndex: 0, parts: [updateSkillPart] }]}
                />
            </TooltipProvider>
        );

        expect(container.textContent).toContain('Updated shared skill');
        expect(container.textContent).toContain('Review PR v2');
        expect(container.textContent).toContain('/review-pr');
        expect(screen.queryByText('Updating skill...')).toBeNull();
    });

    test('renders a list_skills count summary', () => {
        const listSkillsPart = {
            type: 'tool-list_skills',
            toolCallId: 'tool-call-list-skills',
            state: 'output-available',
            input: {},
            output: {
                output: '{"skills":[]}',
                metadata: { count: 3 },
            },
        } satisfies SBChatMessagePart;

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
                    thinkingSteps={[{ stepIndex: 0, parts: [listSkillsPart] }]}
                />
            </TooltipProvider>
        );

        expect(screen.queryByText('Listed skills')).toBeTruthy();
        expect(screen.queryByText('3 skills')).toBeTruthy();
    });

    test('shows a non-pulsing waiting state for an approval-requested tool call', () => {
        const approvalRequestedPart = {
            type: 'tool-create_skill',
            toolCallId: 'tool-call-approval',
            state: 'approval-requested',
            input: {
                name: 'Review PR',
                slug: 'review-pr',
                description: 'Review a pull request.',
                instructions: 'Look for correctness issues first.',
            },
            approval: { id: 'approval-1' },
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
                    isAwaitingToolApproval={true}
                    thinkingSteps={[{ stepIndex: 0, parts: [approvalRequestedPart] }]}
                />
            </TooltipProvider>
        );

        expect(screen.queryByText('Waiting for approval')).toBeTruthy();
        expect(screen.queryByText('Creating skill...')).toBeNull();
    });

    test('shows a denied label for an output-denied tool call', () => {
        const deniedPart = {
            type: 'tool-create_skill',
            toolCallId: 'tool-call-denied',
            title: 'Create skill',
            state: 'output-denied',
            input: {
                name: 'Review PR',
                slug: 'review-pr',
                description: 'Review a pull request.',
                instructions: 'Look for correctness issues first.',
            },
            approval: { id: 'approval-1', approved: false, reason: 'User denied' },
        } satisfies SBChatMessagePart;

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
                    thinkingSteps={[{ stepIndex: 0, parts: [deniedPart] }]}
                />
            </TooltipProvider>
        );

        expect(screen.queryByText('Create skill denied')).toBeTruthy();
        expect(screen.queryByText('Creating skill...')).toBeNull();
    });

    test('renders an unavailable skill load instead of a silent no-op', () => {
        const unavailableSkillPart = {
            type: 'tool-load_skill',
            toolCallId: 'tool-call-2',
            state: 'output-available',
            input: { skill_id: 'ghost-skill' },
            output: { error: 'That skill is not available.' },
        } satisfies SBChatMessagePart;

        const { container } = render(
            <TooltipProvider>
                <DetailsCard
                    chatId="chat-id"
                    isExpanded={true}
                    onExpandedChanged={vi.fn()}
                    isThinking={false}
                    isTurnInProgress={false}
                    isNetworkActive={false}
                    isAwaitingToolApproval={false}
                    thinkingSteps={[{ stepIndex: 0, parts: [unavailableSkillPart] }]}
                />
            </TooltipProvider>
        );

        expect(container.textContent).toContain('ghost-skill');
        expect(container.textContent).toContain('was unavailable');
        expect(screen.queryByText('Loading skill...')).toBeNull();
    });
});
