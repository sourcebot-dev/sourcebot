import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { SharedAgentSkillManagementItem } from '@/ee/features/chat/skills/types';

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
    deleteSharedAgentSkill: vi.fn(),
    setSharedSkillFlag: vi.fn(),
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
    orgSkills: SharedAgentSkillManagementItem[];
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
    test('hides shared skills when Ask is unavailable', async () => {
        const sharedSkill: SharedAgentSkillManagementItem = {
            id: 'skill-1',
            scope: 'SHARED',
            slug: 'review',
            name: 'Review',
            description: 'Review risky changes.',
            enabled: true,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };

        renderWorkspaceAskAgentPage({
            orgSkills: [sharedSkill],
            isAskAgentAvailable: false,
        });

        await screen.findByText('Ask Sourcebot connectors are unavailable');

        expect(screen.queryByText('Review')).toBeNull();
        expect(screen.queryByText('Manage shared skills available to everyone in your workspace.')).toBeNull();
    });

    test('disables shared skill delete while a flag update is pending', async () => {
        const sharedSkill: SharedAgentSkillManagementItem = {
            id: 'skill-1',
            scope: 'SHARED',
            slug: 'review',
            name: 'Review',
            description: 'Review risky changes.',
            enabled: true,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };
        vi.mocked(skillActions.setSharedSkillFlag).mockReturnValue(new Promise(() => undefined));

        renderWorkspaceAskAgentPage({ orgSkills: [sharedSkill] });

        await screen.findByText('Review');

        const deleteButton = screen.getByRole('button', { name: 'Delete Review' });
        expect(deleteButton.hasAttribute('disabled')).toBe(false);

        fireEvent.click(screen.getByRole('switch', { name: 'Featured' }));

        await waitFor(() => {
            expect(deleteButton.hasAttribute('disabled')).toBe(true);
        });
    });

    test("allows deleting a different shared skill while another skill's flag update is pending", async () => {
        const skillA: SharedAgentSkillManagementItem = {
            id: 'skill-a',
            scope: 'SHARED',
            slug: 'review-a',
            name: 'Review A',
            description: 'Review risky changes.',
            enabled: true,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };
        const skillB: SharedAgentSkillManagementItem = {
            id: 'skill-b',
            scope: 'SHARED',
            slug: 'review-b',
            name: 'Review B',
            description: 'Review risky changes.',
            enabled: true,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };
        let resolveUpdate!: (value: SharedAgentSkillManagementItem) => void;
        const pendingUpdate = new Promise<SharedAgentSkillManagementItem>((resolve) => {
            resolveUpdate = resolve;
        });
        vi.mocked(skillActions.setSharedSkillFlag).mockReturnValue(pendingUpdate);

        renderWorkspaceAskAgentPage({ orgSkills: [skillA, skillB] });

        await screen.findByText('Review A');

        fireEvent.click(screen.getAllByRole('switch', { name: 'Featured' })[0]);
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Delete Review A' }).hasAttribute('disabled')).toBe(true);
        });

        const skillBDeleteButton = screen.getByRole('button', { name: 'Delete Review B' });
        expect(skillBDeleteButton.hasAttribute('disabled')).toBe(false);

        fireEvent.click(skillBDeleteButton);

        const dialog = await screen.findByRole('alertdialog', { name: 'Delete Shared Skill' });
        expect(within(dialog).getByText('Review B')).not.toBeNull();

        await act(async () => {
            resolveUpdate({ ...skillA, featured: true });
            await pendingUpdate;
        });
    });

    test('keeps each shared skill delete disabled until its own flag update finishes', async () => {
        const skillA: SharedAgentSkillManagementItem = {
            id: 'skill-a',
            scope: 'SHARED',
            slug: 'review-a',
            name: 'Review A',
            description: 'Review risky changes.',
            enabled: true,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };
        const skillB: SharedAgentSkillManagementItem = {
            id: 'skill-b',
            scope: 'SHARED',
            slug: 'review-b',
            name: 'Review B',
            description: 'Review risky changes.',
            enabled: true,
            featured: false,
            autoEnrolled: false,
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
        };
        let resolveA!: (value: SharedAgentSkillManagementItem) => void;
        let resolveB!: (value: SharedAgentSkillManagementItem) => void;
        const updateA = new Promise<SharedAgentSkillManagementItem>((resolve) => {
            resolveA = resolve;
        });
        const updateB = new Promise<SharedAgentSkillManagementItem>((resolve) => {
            resolveB = resolve;
        });
        vi.mocked(skillActions.setSharedSkillFlag).mockImplementation(({ skillId }) =>
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
