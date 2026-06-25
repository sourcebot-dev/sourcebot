import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AgentSkillListItem, SharedAgentSkillCatalogItem } from '@/ee/features/chat/skills/types';

vi.mock('@/app/api/(client)/client', () => ({
    getMcpServersWithStatus: vi.fn(),
    getMcpServerTools: vi.fn(),
}));
vi.mock('@/ee/features/chat/mcp/actions', () => ({
    disconnectMcpServer: vi.fn(),
}));
vi.mock('@/ee/features/chat/skills/actions', () => ({
    adoptSharedSkill: vi.fn(),
    deletePersonalAgentSkill: vi.fn(),
    makeSharedAgentSkillPersonal: vi.fn(),
    publishPersonalAgentSkillToShared: vi.fn(),
    unadoptSharedSkill: vi.fn(),
}));
vi.mock('@/ee/features/chat/skills/components/workspaceSkillMutations', () => ({
    deleteWorkspaceSkill: vi.fn(),
}));

const clientApi = await import('@/app/api/(client)/client');
const skillActions = await import('@/ee/features/chat/skills/actions');
const { AccountAskAgentEmptyState, AccountAskAgentPage } = await import('./accountAskAgentPage');

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

function renderAccountAskAgentPage({
    personalSkills = [],
    orgSkills = [],
}: {
    personalSkills?: AgentSkillListItem[];
    orgSkills?: SharedAgentSkillCatalogItem[];
}) {
    vi.mocked(clientApi.getMcpServersWithStatus).mockResolvedValue([]);

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <AccountAskAgentPage
                    canManageConnectors={false}
                    initialPersonalSkills={personalSkills}
                    initialOrgSkills={orgSkills}
                />
            </TooltipProvider>
        </QueryClientProvider>,
    );
}

describe('AccountAskAgentEmptyState', () => {
    test('points owners to workspace Ask Sourcebot settings', () => {
        render(<AccountAskAgentEmptyState canManageConnectors={true} />);

        expect(screen.getByText('No connectors configured yet')).toBeTruthy();
        expect(screen.getByText('Open Workspace Ask Sourcebot to approve connectors for your workspace.')).toBeTruthy();
        expect(screen.getByRole('link', { name: /Open Workspace Ask Sourcebot/ }).getAttribute('href')).toBe('/settings/workspaceAskAgent');
    });

    test('tells members to contact an admin', () => {
        render(<AccountAskAgentEmptyState canManageConnectors={false} />);

        expect(screen.getByText('No connectors available')).toBeTruthy();
        expect(screen.getByText(/Contact your workspace admin/)).toBeTruthy();
        expect(screen.queryByRole('link', { name: /Open Workspace Ask Sourcebot/ })).toBeNull();
    });
});

describe('AccountAskAgentPage', () => {
    test('confirms before making an authored shared skill personal', async () => {
        const orgSkill: SharedAgentSkillCatalogItem = {
            id: 'org-skill',
            scope: 'SHARED' as SharedAgentSkillCatalogItem['scope'],
            slug: 'deploy-checklist',
            name: 'Deploy Checklist',
            description: 'Release steps',
            enabled: true,
            featured: false,
            autoEnrolled: true,
            isAdopted: false,
            isRemoved: false,
            isVisibleToUser: true,
            isCreatedByUser: true,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };

        vi.mocked(skillActions.makeSharedAgentSkillPersonal).mockResolvedValue({
            id: 'personal-skill',
            scope: 'PERSONAL',
            slug: orgSkill.slug,
            name: orgSkill.name,
            description: orgSkill.description,
            instructions: 'Do release steps',
            enabled: true,
            createdAt: orgSkill.createdAt,
            updatedAt: orgSkill.updatedAt,
        });

        renderAccountAskAgentPage({ orgSkills: [orgSkill] });

        const actionsButton = screen.getByRole('button', { name: 'Open actions for Deploy Checklist' });
        actionsButton.focus();
        fireEvent.keyDown(actionsButton, { key: 'Enter' });
        fireEvent.click(await screen.findByRole('menuitem', { name: /Make personal/ }));

        expect(skillActions.makeSharedAgentSkillPersonal).not.toHaveBeenCalled();
        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText('Make Shared Skill Personal')).toBeTruthy();
        expect(within(dialog).getByText(/removes the/)).toBeTruthy();
        expect(within(dialog).getByText('/deploy-checklist')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Make personal' }));

        expect(skillActions.makeSharedAgentSkillPersonal).toHaveBeenCalledWith('org-skill');
    });
});
