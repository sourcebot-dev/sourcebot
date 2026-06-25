import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AgentSkillListItem, SharedAgentSkillCatalogItem } from '@/ee/features/chat/skills/types';

vi.mock('@/ee/features/chat/skills/actions', () => ({
    adoptSharedSkill: vi.fn(),
    createPersonalAgentSkill: vi.fn(),
    deletePersonalAgentSkill: vi.fn(),
    deleteSharedAgentSkill: vi.fn(),
    makeSharedAgentSkillPersonal: vi.fn(),
    publishPersonalAgentSkillToShared: vi.fn(),
    unadoptSharedSkill: vi.fn(),
    updatePersonalAgentSkill: vi.fn(),
    updateSharedAgentSkill: vi.fn(),
}));
// The Slate-based editor pulls in suggestion data hooks that need a richer
// environment than these interaction tests; stub it out.
vi.mock('@/ee/features/chat/skills/components/skillInstructionsEditor', () => ({
    SkillInstructionsEditor: () => null,
}));
// The unsaved-changes guard relies on the Next App Router navigation context,
// which is not present under jsdom.
vi.mock('@/ee/features/chat/useUnsavedChangesGuard', () => ({
    useUnsavedChangesGuard: () => ({ active: false, resolve: vi.fn(), bypass: vi.fn() }),
}));

const skillActions = await import('@/ee/features/chat/skills/actions');
const { SkillsPage } = await import('./skillsPage');

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

function renderSkillsPage({
    personalSkills = [],
    sharedSkills = [],
    isOwner = false,
}: {
    personalSkills?: AgentSkillListItem[];
    sharedSkills?: SharedAgentSkillCatalogItem[];
    isOwner?: boolean;
}) {
    return render(
        <TooltipProvider>
            <SkillsPage
                initialPersonalSkills={personalSkills}
                initialSharedSkills={sharedSkills}
                currentUserEmail="jack@sourcebot.dev"
                isOwner={isOwner}
            />
        </TooltipProvider>,
    );
}

const sharedSkill: SharedAgentSkillCatalogItem = {
    id: 'org-skill',
    scope: 'SHARED' as SharedAgentSkillCatalogItem['scope'],
    slug: 'deploy-checklist',
    name: 'Deploy Checklist',
    description: 'Release steps',
    instructions: 'Do release steps',
    createdByEmail: 'author@sourcebot.dev',
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

const personalSkill: AgentSkillListItem = {
    id: 'personal-skill',
    scope: 'PERSONAL' as AgentSkillListItem['scope'],
    slug: 'greet-me',
    name: 'Greet Me',
    description: 'Greets the user by name',
    instructions: 'Say hi.',
    enabled: true,
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
};

describe('SkillsPage', () => {
    test('confirms before making an authored shared skill personal', async () => {
        vi.mocked(skillActions.makeSharedAgentSkillPersonal).mockResolvedValue({
            id: 'new-personal-skill',
            scope: 'PERSONAL',
            slug: sharedSkill.slug,
            name: sharedSkill.name,
            description: sharedSkill.description,
            instructions: sharedSkill.instructions,
            enabled: true,
            createdAt: sharedSkill.createdAt,
            updatedAt: sharedSkill.updatedAt,
        });

        renderSkillsPage({ sharedSkills: [sharedSkill] });

        // The only skill is auto-selected, so its detail pane is shown.
        const actionsButton = screen.getByRole('button', { name: 'Actions for Deploy Checklist' });
        actionsButton.focus();
        fireEvent.keyDown(actionsButton, { key: 'Enter' });
        fireEvent.click(await screen.findByRole('menuitem', { name: /Make personal/ }));

        expect(skillActions.makeSharedAgentSkillPersonal).not.toHaveBeenCalled();
        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText('Make Shared Skill Personal')).toBeTruthy();
        expect(within(dialog).getByText('/deploy-checklist')).toBeTruthy();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Make personal' }));

        expect(skillActions.makeSharedAgentSkillPersonal).toHaveBeenCalledWith('org-skill');
    });

    test('publishes a personal skill when the Shared toggle is turned on', async () => {
        vi.mocked(skillActions.publishPersonalAgentSkillToShared).mockResolvedValue({
            ...sharedSkill,
            id: 'published-skill',
            slug: personalSkill.slug,
            name: personalSkill.name,
            autoEnrolled: false,
        });

        renderSkillsPage({ personalSkills: [personalSkill] });

        fireEvent.click(screen.getByRole('switch', { name: 'Shared' }));

        expect(skillActions.publishPersonalAgentSkillToShared).toHaveBeenCalledWith('personal-skill');
    });
});
