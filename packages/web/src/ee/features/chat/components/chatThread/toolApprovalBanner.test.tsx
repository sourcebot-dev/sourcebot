import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ToolApprovalProvider } from '../../toolApprovalContext';
import { AskCommandsContext } from '../../askCommandsContext';
import { ApprovalRequestedToolPart, ToolApprovalBanner } from './toolApprovalBanner';
import type { AskCommandDefinition } from '@/features/chat/commands/types';
import { ASK_COMMAND_SOURCE_PERSONAL_SKILL, ASK_COMMAND_SOURCE_SHARED_SKILL } from '@/features/chat/commands/types';

afterEach(() => {
    cleanup();
});

const askCommands: AskCommandDefinition[] = [
    {
        id: 'skill-1',
        sourceId: ASK_COMMAND_SOURCE_PERSONAL_SKILL,
        sourceLabel: 'Personal',
        slug: 'review-pr',
        name: 'Review PR',
        description: 'Review a pull request.',
        isSynced: false,
    },
    {
        id: 'skill-2',
        sourceId: ASK_COMMAND_SOURCE_SHARED_SKILL,
        sourceLabel: 'Shared',
        slug: 'audit',
        name: 'Audit Billing',
        description: 'Audit billing issues.',
        isSynced: false,
    },
];

const renderBanner = (parts: ApprovalRequestedToolPart[]) =>
    render(
        <ToolApprovalProvider value={vi.fn()}>
            <AskCommandsContext.Provider value={askCommands}>
                <ToolApprovalBanner parts={parts} />
            </AskCommandsContext.Provider>
        </ToolApprovalProvider>
    );

describe('ToolApprovalBanner', () => {
    test('headlines the skill name from the input for create_skill', () => {
        const { container } = renderBanner([
            {
                type: 'tool-create_skill',
                toolCallId: 'tool-call-1',
                state: 'approval-requested',
                input: {
                    name: 'Release Checklist',
                    slug: 'release-checklist',
                    description: 'Run the release checklist.',
                    instructions: 'Check the changelog first.',
                },
                approval: { id: 'approval-1' },
            },
        ]);

        expect(container.textContent).toContain('Agent wants to create skill');
        expect(container.textContent).toContain('Release Checklist');
        expect(container.textContent).not.toContain('Agent wants to use');
    });

    test('resolves the update_skill display name from askCommands', () => {
        const { container } = renderBanner([
            {
                type: 'tool-update_skill',
                toolCallId: 'tool-call-2',
                state: 'approval-requested',
                input: { slug: 'review-pr', scope: 'personal', name: 'Renamed' },
                approval: { id: 'approval-2' },
            },
        ]);

        expect(container.textContent).toContain('Agent wants to update your skill');
        expect(container.textContent).toContain('Review PR');
    });

    test('labels shared skills and falls back to /slug when no command matches', () => {
        const { container } = renderBanner([
            {
                type: 'tool-update_skill',
                toolCallId: 'tool-call-3',
                state: 'approval-requested',
                input: { slug: 'unadopted', scope: 'shared', description: 'New description.' },
                approval: { id: 'approval-3' },
            },
        ]);

        expect(container.textContent).toContain('Agent wants to update shared skill');
        expect(container.textContent).toContain('/unadopted');
    });

    test('keeps the generic line for tools without a summary renderer', () => {
        const { container } = renderBanner([
            {
                type: 'dynamic-tool',
                toolName: 'mcp_linear__save_issue',
                toolCallId: 'tool-call-4',
                state: 'approval-requested',
                input: { title: 'Issue' },
                approval: { id: 'approval-4' },
            },
        ]);

        expect(container.textContent).toContain('Agent wants to use');
    });
});
