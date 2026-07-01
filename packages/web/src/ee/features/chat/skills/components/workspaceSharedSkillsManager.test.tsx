import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';
import type { SharedAgentSkillManagementItem } from '@/ee/features/chat/skills/types';

// The manager mutates through workspaceSkillMutations, which calls these server
// actions; stub them so the client component can render under jsdom.
vi.mock('@/ee/features/chat/skills/actions', () => ({
    deleteSharedAgentSkill: vi.fn(),
    setSharedSkillFlag: vi.fn(),
}));
// next/link needs the app-router context in real use; render a plain anchor.
vi.mock('next/link', async () => {
    const { createElement } = await import('react');
    return {
        default: ({ href, children }: { href: string; children: ReactNode }) =>
            createElement('a', { href }, children),
    };
});

const skillActions = await import('@/ee/features/chat/skills/actions');
const { WorkspaceSharedSkillsManager } = await import('./workspaceSharedSkillsManager');

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

function makeSkill(
    overrides: Partial<SharedAgentSkillManagementItem> & Pick<SharedAgentSkillManagementItem, 'id' | 'slug' | 'name'>,
): SharedAgentSkillManagementItem {
    return {
        scope: 'SHARED',
        description: '',
        enabled: true,
        autoEnrolled: false,
        source: null,
        createdByEmail: null,
        createdAt: '2026-06-18T00:00:00.000Z',
        updatedAt: '2026-06-18T00:00:00.000Z',
        ...overrides,
    };
}

function renderManager(skills: SharedAgentSkillManagementItem[], initialSearch?: string) {
    return render(
        <TooltipProvider>
            <WorkspaceSharedSkillsManager initialOrgSkills={skills} initialSearch={initialSearch} />
        </TooltipProvider>,
    );
}

const syncedSkill = makeSkill({
    id: 'synced',
    slug: 'review',
    name: 'Code Review',
    source: { repoName: 'github.com/acme/backend', filePath: 'docs/review.md', revision: 'main' },
    createdByEmail: 'jack@sourcebot.dev',
});

const manualSkill = makeSkill({
    id: 'manual',
    slug: 'greet',
    name: 'Greeter',
    createdByEmail: 'sam@sourcebot.dev',
});

describe('WorkspaceSharedSkillsManager', () => {
    test('marks synced skills, shows the creator, and a total count', () => {
        renderManager([syncedSkill, manualSkill]);

        // Synced skills get a compact marker; the full repo name is no longer shown.
        expect(screen.getAllByTitle('Synced from a repository')).toHaveLength(1);
        expect(screen.queryByText('github.com/acme/backend')).toBeNull();
        expect(screen.getByText('jack@sourcebot.dev')).toBeTruthy();
        expect(screen.getByText('sam@sourcebot.dev')).toBeTruthy();
        expect(screen.getByText('2 of 2 shared skills')).toBeTruthy();
    });

    test('links each skill name to the account skills page with its id', () => {
        renderManager([syncedSkill]);

        const link = screen.getByRole('link', { name: 'Code Review' });
        expect(link.getAttribute('href')).toBe('/settings/skills?skill=synced');
    });

    test('pre-fills the search box from initialSearch (deep link from the account page)', () => {
        renderManager([syncedSkill, manualSkill], 'Code Review');

        expect((screen.getByPlaceholderText('Search skills or commands...') as HTMLInputElement).value).toBe('Code Review');
        expect(screen.getByText('Code Review')).toBeTruthy();
        expect(screen.queryByText('Greeter')).toBeNull();
        expect(screen.getByText('1 of 2 shared skills')).toBeTruthy();
    });

    test('searches over name and command', () => {
        renderManager([syncedSkill, manualSkill]);

        fireEvent.change(screen.getByPlaceholderText('Search skills or commands...'), {
            target: { value: 'greet' },
        });

        expect(screen.queryByText('Code Review')).toBeNull();
        expect(screen.getByText('Greeter')).toBeTruthy();
        expect(screen.getByText('1 of 2 shared skills')).toBeTruthy();
    });

    test('filters by Synced and Manual', () => {
        renderManager([syncedSkill, manualSkill]);

        fireEvent.click(screen.getByText('Synced'));
        expect(screen.getByText('Code Review')).toBeTruthy();
        expect(screen.queryByText('Greeter')).toBeNull();

        fireEvent.click(screen.getByText('Manual'));
        expect(screen.queryByText('Code Review')).toBeNull();
        expect(screen.getByText('Greeter')).toBeTruthy();
    });

    test('toggles auto-enroll through the row switch', async () => {
        vi.mocked(skillActions.setSharedSkillFlag).mockResolvedValue({
            ...syncedSkill,
            autoEnrolled: true,
        });

        renderManager([syncedSkill]);

        fireEvent.click(screen.getByRole('switch', { name: 'Auto' }));

        await waitFor(() => expect(skillActions.setSharedSkillFlag).toHaveBeenCalledWith({
            skillId: 'synced',
            data: { autoEnrolled: true },
        }));
    });

    test('reports no matches when search and filters exclude everything', () => {
        renderManager([syncedSkill, manualSkill]);

        fireEvent.change(screen.getByPlaceholderText('Search skills or commands...'), {
            target: { value: 'zzz-nothing' },
        });

        expect(screen.getByText('No skills match your search.')).toBeTruthy();
        expect(screen.getByText('0 of 2 shared skills')).toBeTruthy();
    });
});
