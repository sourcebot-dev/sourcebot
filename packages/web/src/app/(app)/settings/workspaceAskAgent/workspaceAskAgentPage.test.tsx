import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { OrgAgentSkillManagementItem } from '@/ee/features/chat/skills/types';

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

vi.mock('@/app/api/(client)/client', () => ({
    getMcpConfiguration: vi.fn(),
    getMcpServersWithStatus: vi.fn(),
}));

vi.mock('@/ee/features/chat/mcp/actions', () => ({
    checkMcpServerDynamicClientRegistration: vi.fn(),
    createMcpServer: vi.fn(),
    createStaticOAuthMcpServer: vi.fn(),
    deleteMcpServer: vi.fn(),
    updateMcpServerOAuthScopes: vi.fn(),
}));

vi.mock('@/ee/features/chat/skills/actions', () => ({
    deleteOrgAgentSkill: vi.fn(),
    setOrgSkillFlag: vi.fn(),
}));

const clientApi = await import('@/app/api/(client)/client');
const skillActions = await import('@/ee/features/chat/skills/actions');
const { WorkspaceAskAgentPage } = await import('./workspaceAskAgentPage');

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

function renderWorkspaceAskAgentPage({
    orgSkills,
    isAskAgentAvailable = true,
}: {
    orgSkills: OrgAgentSkillManagementItem[];
    isAskAgentAvailable?: boolean;
}) {
    vi.mocked(clientApi.getMcpConfiguration).mockResolvedValue({
        allowedMode: 'approved_only',
        isAskAgentAvailable,
        servers: [],
    });
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
                <WorkspaceAskAgentPage
                    oauthRedirectUrl="http://localhost/api/oauth/callback"
                    initialOrgSkills={orgSkills}
                />
            </TooltipProvider>
        </QueryClientProvider>,
    );
}

describe('WorkspaceAskAgentPage', () => {
    test('hides workspace skills when Ask is unavailable', async () => {
        const orgSkill: OrgAgentSkillManagementItem = {
            id: 'skill-1',
            scope: 'ORG' as OrgAgentSkillManagementItem['scope'],
            slug: 'review',
            name: 'Review',
            description: 'Review risky changes.',
            argumentNames: [],
            enabled: true,
            autoInvocationEnabled: false,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };

        renderWorkspaceAskAgentPage({
            orgSkills: [orgSkill],
            isAskAgentAvailable: false,
        });

        await screen.findByText('Ask Sourcebot connectors are unavailable');

        expect(screen.queryByText('Review')).toBeNull();
        expect(screen.queryByText('Manage workspace slash-command behavior for Ask Sourcebot.')).toBeNull();
    });

    test('disables workspace skill delete while a flag update is pending', async () => {
        const orgSkill: OrgAgentSkillManagementItem = {
            id: 'skill-1',
            scope: 'ORG' as OrgAgentSkillManagementItem['scope'],
            slug: 'review',
            name: 'Review',
            description: 'Review risky changes.',
            argumentNames: [],
            enabled: true,
            autoInvocationEnabled: false,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };
        vi.mocked(skillActions.setOrgSkillFlag).mockReturnValue(new Promise(() => undefined));

        renderWorkspaceAskAgentPage({ orgSkills: [orgSkill] });

        await screen.findByText('Review');

        const deleteButton = screen.getByRole('button', { name: 'Delete Review' });
        expect(deleteButton.hasAttribute('disabled')).toBe(false);

        fireEvent.click(screen.getByRole('switch', { name: 'Featured' }));

        await waitFor(() => {
            expect(deleteButton.hasAttribute('disabled')).toBe(true);
        });
    });

    test("allows deleting a different workspace skill while another skill's flag update is pending", async () => {
        const skillA: OrgAgentSkillManagementItem = {
            id: 'skill-a',
            scope: 'ORG' as OrgAgentSkillManagementItem['scope'],
            slug: 'review-a',
            name: 'Review A',
            description: 'Review risky changes.',
            argumentNames: [],
            enabled: true,
            autoInvocationEnabled: false,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };
        const skillB: OrgAgentSkillManagementItem = {
            id: 'skill-b',
            scope: 'ORG' as OrgAgentSkillManagementItem['scope'],
            slug: 'review-b',
            name: 'Review B',
            description: 'Review risky changes.',
            argumentNames: [],
            enabled: true,
            autoInvocationEnabled: false,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };
        let resolveUpdate!: (value: OrgAgentSkillManagementItem) => void;
        const pendingUpdate = new Promise<OrgAgentSkillManagementItem>((resolve) => {
            resolveUpdate = resolve;
        });
        vi.mocked(skillActions.setOrgSkillFlag).mockReturnValue(pendingUpdate);

        renderWorkspaceAskAgentPage({ orgSkills: [skillA, skillB] });

        await screen.findByText('Review A');

        fireEvent.click(screen.getAllByRole('switch', { name: 'Featured' })[0]);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete Review A' }).hasAttribute('disabled')).toBe(true);
        });

        const skillBDeleteButton = screen.getByRole('button', { name: 'Delete Review B' });
        expect(skillBDeleteButton.hasAttribute('disabled')).toBe(false);

        fireEvent.click(skillBDeleteButton);

        const dialog = await screen.findByRole('alertdialog', { name: 'Delete Workspace Skill' });
        expect(within(dialog).getByText('Review B')).not.toBeNull();

        await act(async () => {
            resolveUpdate({ ...skillA, featured: true });
            await pendingUpdate;
        });
    });

    test('keeps each workspace skill delete disabled until its own flag update finishes', async () => {
        const skillA: OrgAgentSkillManagementItem = {
            id: 'skill-a',
            scope: 'ORG' as OrgAgentSkillManagementItem['scope'],
            slug: 'review-a',
            name: 'Review A',
            description: 'Review risky changes.',
            argumentNames: [],
            enabled: true,
            autoInvocationEnabled: false,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };
        const skillB: OrgAgentSkillManagementItem = {
            id: 'skill-b',
            scope: 'ORG' as OrgAgentSkillManagementItem['scope'],
            slug: 'review-b',
            name: 'Review B',
            description: 'Review risky changes.',
            argumentNames: [],
            enabled: true,
            autoInvocationEnabled: false,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };
        let resolveA!: (value: OrgAgentSkillManagementItem) => void;
        let resolveB!: (value: OrgAgentSkillManagementItem) => void;
        const updateA = new Promise<OrgAgentSkillManagementItem>((resolve) => {
            resolveA = resolve;
        });
        const updateB = new Promise<OrgAgentSkillManagementItem>((resolve) => {
            resolveB = resolve;
        });
        vi.mocked(skillActions.setOrgSkillFlag).mockImplementation(({ skillId }) =>
            skillId === 'skill-a' ? updateA : updateB,
        );

        renderWorkspaceAskAgentPage({ orgSkills: [skillA, skillB] });

        await screen.findByText('Review A');
        const featuredSwitches = screen.getAllByRole('switch', { name: 'Featured' });

        fireEvent.click(featuredSwitches[0]);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete Review A' }).hasAttribute('disabled')).toBe(true);
        });

        fireEvent.click(featuredSwitches[1]);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete Review B' }).hasAttribute('disabled')).toBe(true);
        });

        await act(async () => {
            resolveA({ ...skillA, featured: true });
            await updateA;
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete Review A' }).hasAttribute('disabled')).toBe(false);
        });
        expect(screen.getByRole('button', { name: 'Delete Review B' }).hasAttribute('disabled')).toBe(true);

        await act(async () => {
            resolveB({ ...skillB, featured: true });
            await updateB;
        });

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete Review B' }).hasAttribute('disabled')).toBe(false);
        });
    });
});
