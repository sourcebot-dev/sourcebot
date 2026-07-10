import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ReactNode } from 'react';
import type { AgentSkillListItem, SharedAgentSkillCatalogItem } from '@/ee/features/chat/skills/types';

// The repo-import dialog's internals (repo/file browsing) are covered by its own
// test file; here it is stubbed with a trigger that immediately hands the page a
// parsed skill plus its source provenance, exercising the page-side import flow.
vi.mock('@/ee/features/chat/skills/components/importFromRepoDialog', () => ({
    ImportFromRepoDialog: ({ open, onImport }: {
        open: boolean;
        onImport: (imported: unknown) => void;
    }) => open
        ? (
            <button
                onClick={() => onImport({
                    parsed: {
                        name: 'Deploy Widgets',
                        slug: 'deploy-widgets',
                        description: 'Steps to deploy',
                        instructions: 'Run the deploy script.',
                        hasFrontmatter: true,
                    },
                    source: {
                        repoName: 'github.com/acme/widgets',
                        filePath: 'docs/skill.md',
                        revision: 'main',
                        blobSha: 'blob-sha-123',
                    },
                })}
            >
                Import stub skill
            </button>
        )
        : null,
}));

vi.mock('@/ee/features/chat/skills/actions', () => ({
    adoptSharedSkill: vi.fn(),
    createPersonalAgentSkill: vi.fn(),
    deletePersonalAgentSkill: vi.fn(),
    deleteSharedAgentSkill: vi.fn(),
    getAgentSkillSyncPreview: vi.fn(),
    makeSharedAgentSkillPersonal: vi.fn(),
    publishPersonalAgentSkillToShared: vi.fn(),
    unadoptSharedSkill: vi.fn(),
    updatePersonalAgentSkill: vi.fn(),
    updatePersonalAgentSkillFromSource: vi.fn(),
    updateSharedAgentSkill: vi.fn(),
    updateSharedAgentSkillFromSource: vi.fn(),
}));
// The synced-skill banner checks freshness via this client; the repo-import dialog
// (always mounted) also imports from here, but its queries stay disabled while closed.
vi.mock('@/app/api/(client)/client', () => ({
    getSkillSourceStatus: vi.fn(),
    getFileSource: vi.fn(),
    getFiles: vi.fn(),
    listRepos: vi.fn(),
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
// The reading view renders instructions through the chat MarkdownRenderer, which
// pulls in react-markdown, the Lezer highlighter, and a router context; swap in a
// lightweight placeholder that still honors the forwarded ref.
vi.mock('@/ee/features/chat/components/chatThread/markdownRenderer', async () => {
    const { forwardRef, createElement } = await import('react');
    return {
        MarkdownRenderer: forwardRef<HTMLDivElement, { content: string }>(({ content }, ref) =>
            createElement('div', { ref, 'data-testid': 'markdown-preview' }, content),
        ),
    };
});
// The table-of-contents hook relies on IntersectionObserver/MutationObserver,
// which jsdom does not implement.
vi.mock('@/ee/features/chat/useTOCItems', () => ({
    useExtractTOCItems: () => ({ tocItems: [], activeId: '' }),
}));
// The detail dropdown deep-links via next/link inside a Radix `asChild` slot, so
// the mock must forward the merged props (role, ref, etc.) onto the anchor.
vi.mock('next/link', async () => {
    const { createElement, forwardRef } = await import('react');
    return {
        default: forwardRef<HTMLAnchorElement, { href: string; children: ReactNode }>(
            ({ href, children, ...props }, ref) => createElement('a', { href, ref, ...props }, children),
        ),
    };
});

const skillActions = await import('@/ee/features/chat/skills/actions');
const clientApi = await import('@/app/api/(client)/client');
const { SkillsPage } = await import('./skillsPage');

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

function renderSkillsPage({
    personalSkills = [],
    sharedSkills = [],
    isOwner = false,
    initialSelectedId,
    permissionSyncEnabled = true,
}: {
    personalSkills?: AgentSkillListItem[];
    sharedSkills?: SharedAgentSkillCatalogItem[];
    isOwner?: boolean;
    initialSelectedId?: string;
    permissionSyncEnabled?: boolean;
}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <SkillsPage
                    initialPersonalSkills={personalSkills}
                    initialSharedSkills={sharedSkills}
                    currentUserEmail="jack@sourcebot.dev"
                    isOwner={isOwner}
                    initialSelectedId={initialSelectedId}
                    permissionSyncEnabled={permissionSyncEnabled}
                />
            </TooltipProvider>
        </QueryClientProvider>,
    );
}

const sharedSkill: SharedAgentSkillCatalogItem = {
    id: 'org-skill',
    scope: 'SHARED' as SharedAgentSkillCatalogItem['scope'],
    slug: 'deploy-checklist',
    name: 'Deploy Checklist',
    description: 'Release steps',
    instructions: 'Do release steps',
    source: null,
    createdByEmail: 'author@sourcebot.dev',
    enabled: true,
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
    source: null,
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
};

const syncedSkill: AgentSkillListItem = {
    id: 'synced-skill',
    scope: 'PERSONAL' as AgentSkillListItem['scope'],
    slug: 'deploy-widgets',
    name: 'Deploy Widgets',
    description: 'Deploy steps',
    instructions: 'Run the deploy script.',
    enabled: true,
    source: { repoName: 'github.com/acme/widgets', filePath: 'docs/skill.md', revision: 'main' },
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
};

const sharedSyncedSkill: SharedAgentSkillCatalogItem = {
    ...sharedSkill,
    id: 'shared-synced-skill',
    slug: 'deploy-widgets',
    name: 'Deploy Widgets',
    source: { repoName: 'github.com/acme/widgets', filePath: 'docs/skill.md', revision: 'main' },
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
            source: null,
            createdAt: sharedSkill.createdAt,
            updatedAt: sharedSkill.updatedAt,
        });

        renderSkillsPage({ sharedSkills: [sharedSkill] });

        // The only skill is auto-selected, so its detail pane is shown. Toggling
        // "Shared" off is the make-personal path (there is no menu item for it).
        fireEvent.click(screen.getByRole('switch', { name: 'Shared' }));

        expect(skillActions.makeSharedAgentSkillPersonal).not.toHaveBeenCalled();
        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText('Make Shared Skill Personal')).toBeTruthy();
        expect(within(dialog).getByText('/deploy-checklist')).toBeTruthy();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Make personal' }));

        expect(skillActions.makeSharedAgentSkillPersonal).toHaveBeenCalledWith('org-skill', { entryPoint: 'skills_settings' });
    });

    test("removes another user's shared skill from the catalog when an owner makes it personal", async () => {
        vi.mocked(skillActions.makeSharedAgentSkillPersonal).mockResolvedValue({
            id: 'new-personal-skill',
            scope: 'PERSONAL',
            slug: sharedSkill.slug,
            name: sharedSkill.name,
            description: sharedSkill.description,
            instructions: sharedSkill.instructions,
            enabled: true,
            source: null,
            createdAt: sharedSkill.createdAt,
            updatedAt: sharedSkill.updatedAt,
        });

        renderSkillsPage({
            sharedSkills: [{ ...sharedSkill, isCreatedByUser: false }],
            isOwner: true,
        });

        fireEvent.click(screen.getByRole('switch', { name: 'Shared' }));
        const dialog = await screen.findByRole('alertdialog');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Make personal' }));

        await waitFor(() => expect(screen.getByText('No shared skills yet.')).toBeTruthy());
        expect(screen.queryByRole('switch', { name: 'Enable Deploy Checklist' })).toBeNull();
        expect(skillActions.makeSharedAgentSkillPersonal).toHaveBeenCalledWith('org-skill', { entryPoint: 'skills_settings' });
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

        expect(skillActions.publishPersonalAgentSkillToShared).toHaveBeenCalledWith('personal-skill', { entryPoint: 'skills_settings' });
    });

    test('confirms before sharing a synced skill, warning that owners without repo access can still see it', async () => {
        vi.mocked(clientApi.getSkillSourceStatus).mockResolvedValue({ status: 'in_sync' });
        vi.mocked(skillActions.publishPersonalAgentSkillToShared).mockResolvedValue({
            ...sharedSyncedSkill,
            id: 'published-synced-skill',
            autoEnrolled: false,
        });

        renderSkillsPage({ personalSkills: [syncedSkill] });

        // Flipping Shared on a synced skill opens a confirm dialog rather than
        // publishing immediately.
        fireEvent.click(await screen.findByRole('switch', { name: 'Shared' }));
        expect(skillActions.publishPersonalAgentSkillToShared).not.toHaveBeenCalled();

        const dialog = await screen.findByRole('alertdialog');
        expect(within(dialog).getByText('Share synced skill with your workspace?')).toBeTruthy();
        expect(within(dialog).getByText(/Organization owners who don.t have access/)).toBeTruthy();
        expect(within(dialog).getByText(/Members without access to the repository won.t see it/)).toBeTruthy();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Share skill' }));

        expect(skillActions.publishPersonalAgentSkillToShared).toHaveBeenCalledWith('synced-skill', { entryPoint: 'skills_settings' });
    });

    test('shares a synced skill immediately (no warning) when permission syncing is off', async () => {
        vi.mocked(clientApi.getSkillSourceStatus).mockResolvedValue({ status: 'in_sync' });
        vi.mocked(skillActions.publishPersonalAgentSkillToShared).mockResolvedValue({
            ...sharedSyncedSkill,
            id: 'published-synced-skill',
            autoEnrolled: false,
        });

        renderSkillsPage({ personalSkills: [syncedSkill], permissionSyncEnabled: false });

        fireEvent.click(await screen.findByRole('switch', { name: 'Shared' }));

        // With syncing off there is no access caveat, so it publishes directly
        // without the confirmation dialog.
        await waitFor(() => expect(skillActions.publishPersonalAgentSkillToShared).toHaveBeenCalledWith('synced-skill', { entryPoint: 'skills_settings' }));
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    test("enables another member's shared skill from the list toggle, with no shared toggle or kebab", () => {
        vi.mocked(skillActions.adoptSharedSkill).mockResolvedValue({ success: true });

        const othersSkill: SharedAgentSkillCatalogItem = {
            ...sharedSkill,
            id: 'others-skill',
            isCreatedByUser: false,
            autoEnrolled: false,
            isAdopted: false,
            isRemoved: false,
            isVisibleToUser: false,
        };

        renderSkillsPage({ sharedSkills: [othersSkill] });

        expect(screen.queryByRole('switch', { name: 'Shared' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Actions for/ })).toBeNull();

        fireEvent.click(screen.getByRole('switch', { name: 'Enable Deploy Checklist' }));

        expect(skillActions.adoptSharedSkill).toHaveBeenCalledWith('others-skill', { entryPoint: 'skills_settings' });
    });

    test("shows the list toggle as on for shared skills the member has enabled", () => {
        const enabledSkill: SharedAgentSkillCatalogItem = {
            ...sharedSkill,
            id: 'enabled-skill',
            isCreatedByUser: false,
            isVisibleToUser: true,
        };

        renderSkillsPage({ sharedSkills: [enabledSkill] });

        expect(screen.getByRole('switch', { name: 'Enable Deploy Checklist', checked: true })).toBeTruthy();
    });

    test('keeps list skill names readable when status badges are present', () => {
        const longBadgedSkill: SharedAgentSkillCatalogItem = {
            ...sharedSyncedSkill,
            id: 'long-badged-skill',
            name: 'Code Contribution Guidelines',
            slug: 'contributing',
            autoEnrolled: true,
            isCreatedByUser: false,
        };

        renderSkillsPage({ sharedSkills: [longBadgedSkill] });

        const rowButton = screen.getByRole('button', { name: /Code Contribution Guidelines/ });
        const name = within(rowButton).getByText('Code Contribution Guidelines');
        const command = within(rowButton).getByText('/contributing');
        const syncedBadge = within(rowButton).getByText('Synced');
        expect(name.className).not.toContain('truncate');
        expect(name.className).toContain('break-words');
        expect(syncedBadge.parentElement?.className).toContain('mt-1');
        expect(syncedBadge.parentElement).not.toBe(command.parentElement);
        expect(within(rowButton).getByText('Auto')).toBeTruthy();
    });

    test('shows a repo-synced skill\'s provenance and updates it from source without a warning when nothing is overwritten', async () => {
        vi.mocked(clientApi.getSkillSourceStatus).mockResolvedValue({ status: 'update_available' });
        vi.mocked(skillActions.getAgentSkillSyncPreview).mockResolvedValue({
            status: 'update_available',
            changedFields: ['instructions'],
            overwrittenLocalEdits: [],
        });
        vi.mocked(skillActions.updatePersonalAgentSkillFromSource).mockResolvedValue({
            ...syncedSkill,
            instructions: 'Refreshed deploy script.',
            updatedAt: '2026-06-25T00:00:00.000Z',
        });

        renderSkillsPage({ personalSkills: [syncedSkill] });

        // Provenance banner is shown, and the skill stays editable and shareable.
        expect(await screen.findByText('github.com/acme/widgets')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
        expect(screen.getByRole('switch', { name: 'Shared' })).toBeTruthy();

        // The freshness check resolves to "update available", surfacing the action.
        const updateButton = await screen.findByRole('button', { name: /Update from source/ });
        fireEvent.click(updateButton);

        // The sync preview reports no local edits at risk, so no warning dialog is
        // shown and the sync proceeds directly.
        await waitFor(() => expect(skillActions.updatePersonalAgentSkillFromSource).toHaveBeenCalledWith('synced-skill', { entryPoint: 'skills_settings' }));
        expect(skillActions.getAgentSkillSyncPreview).toHaveBeenCalledWith('synced-skill');
        expect(screen.queryByText('Overwrite local edits?')).toBeNull();
        expect(clientApi.getSkillSourceStatus).toHaveBeenCalledWith('synced-skill');
    });

    test('warns before a sync that would overwrite local edits and syncs on confirm', async () => {
        vi.mocked(clientApi.getSkillSourceStatus).mockResolvedValue({ status: 'update_available' });
        vi.mocked(skillActions.getAgentSkillSyncPreview).mockResolvedValue({
            status: 'update_available',
            changedFields: ['description', 'instructions'],
            overwrittenLocalEdits: ['description', 'instructions'],
        });
        vi.mocked(skillActions.updatePersonalAgentSkillFromSource).mockResolvedValue({
            ...syncedSkill,
            updatedAt: '2026-06-25T00:00:00.000Z',
        });

        renderSkillsPage({ personalSkills: [syncedSkill] });

        fireEvent.click(await screen.findByRole('button', { name: /Update from source/ }));

        // The preview reports edited fields at risk, so the sync pauses on a warning.
        expect(await screen.findByText('Overwrite local edits?')).toBeTruthy();
        expect(skillActions.updatePersonalAgentSkillFromSource).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Overwrite and sync' }));

        await waitFor(() => expect(skillActions.updatePersonalAgentSkillFromSource).toHaveBeenCalledWith('synced-skill', { entryPoint: 'skills_settings' }));
    });

    test('offers Force sync when the skill is already up to date', async () => {
        vi.mocked(clientApi.getSkillSourceStatus).mockResolvedValue({ status: 'in_sync' });
        vi.mocked(skillActions.getAgentSkillSyncPreview).mockResolvedValue({
            status: 'in_sync',
            changedFields: ['instructions'],
            overwrittenLocalEdits: ['instructions'],
        });
        vi.mocked(skillActions.updatePersonalAgentSkillFromSource).mockResolvedValue({
            ...syncedSkill,
            updatedAt: '2026-06-25T00:00:00.000Z',
        });

        renderSkillsPage({ personalSkills: [syncedSkill] });

        // Up-to-date skills still expose a sync action to restore the source
        // content over local edits, behind the same conditional warning.
        fireEvent.click(await screen.findByRole('button', { name: /Force sync/ }));

        expect(await screen.findByText('Overwrite local edits?')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Overwrite and sync' }));

        await waitFor(() => expect(skillActions.updatePersonalAgentSkillFromSource).toHaveBeenCalledWith('synced-skill', { entryPoint: 'skills_settings' }));
    });

    test('lets you edit a synced skill\'s content, marking it as synced', async () => {
        vi.mocked(clientApi.getSkillSourceStatus).mockResolvedValue({ status: 'in_sync' });

        renderSkillsPage({ personalSkills: [syncedSkill] });

        fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

        // Every field of a synced skill is editable, including its content.
        const nameInput = await screen.findByDisplayValue('Deploy Widgets') as HTMLInputElement;
        expect(nameInput.disabled).toBe(false);
        expect((screen.getByDisplayValue('deploy-widgets') as HTMLInputElement).disabled).toBe(false);
        expect((screen.getByDisplayValue('Deploy steps') as HTMLTextAreaElement).disabled).toBe(false);
        // The form still surfaces the skill's synced provenance.
        expect(screen.getByText(/Synced from github\.com\/acme\/widgets/)).toBeTruthy();
    });

    test('keeps a shared skill synced and lets an owner update it from source', async () => {
        vi.mocked(clientApi.getSkillSourceStatus).mockResolvedValue({ status: 'update_available' });
        vi.mocked(skillActions.getAgentSkillSyncPreview).mockResolvedValue({
            status: 'update_available',
            changedFields: ['instructions'],
            overwrittenLocalEdits: [],
        });
        vi.mocked(skillActions.updateSharedAgentSkillFromSource).mockResolvedValue({
            ...sharedSyncedSkill,
            instructions: 'Refreshed deploy script.',
            updatedAt: '2026-06-26T00:00:00.000Z',
        });

        renderSkillsPage({ sharedSkills: [sharedSyncedSkill], isOwner: true });

        // A shared skill carries its repo provenance, and the owner can refresh it.
        expect(await screen.findByText('github.com/acme/widgets')).toBeTruthy();
        const updateButton = await screen.findByRole('button', { name: /Update from source/ });
        fireEvent.click(updateButton);

        // The shared (not personal) update path runs for a shared skill.
        await waitFor(() => expect(skillActions.updateSharedAgentSkillFromSource).toHaveBeenCalledWith('shared-synced-skill', { entryPoint: 'skills_settings' }));
        expect(skillActions.updatePersonalAgentSkillFromSource).not.toHaveBeenCalled();
    });

    test('imports a repository skill into the create form and saves it with its source', async () => {
        vi.mocked(skillActions.createPersonalAgentSkill).mockResolvedValue({
            ...syncedSkill,
            id: 'imported-skill',
        });

        renderSkillsPage({});

        fireEvent.keyDown(screen.getByRole('button', { name: 'Add skill' }), { key: 'Enter' });
        fireEvent.click(await screen.findByText('Import from repository'));
        fireEvent.click(await screen.findByText('Import stub skill'));

        // The import lands in the create form (not a direct create) so the user
        // reviews the content — and can fill in a missing description — first.
        expect(await screen.findByText('New skill')).toBeTruthy();
        expect(screen.getByDisplayValue('Deploy Widgets')).toBeTruthy();
        expect(screen.getByDisplayValue('Steps to deploy')).toBeTruthy();
        expect(skillActions.createPersonalAgentSkill).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /Create skill/ }));

        // Saving carries the repository provenance so the skill is created synced.
        await waitFor(() => expect(skillActions.createPersonalAgentSkill).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Deploy Widgets',
                description: 'Steps to deploy',
                source: {
                    repoName: 'github.com/acme/widgets',
                    filePath: 'docs/skill.md',
                    revision: 'main',
                    blobSha: 'blob-sha-123',
                },
            }),
            { entryPoint: 'skills_settings', creationMethod: 'repository' },
        ));
    });

    test('imports a skill from a markdown file and pre-populates the create form', async () => {
        const { container } = renderSkillsPage({});

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(fileInput).toBeTruthy();

        const content = '---\nname: Greet Me\ndescription: Greets warmly\n---\n\nSay hello to the user by name.';
        const file = new File([content], 'greet-me.md', { type: 'text/markdown' });
        // jsdom does not implement Blob/File.text(); provide it for the read.
        Object.defineProperty(file, 'text', { value: async () => content });
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Front matter fills name, command, and description; the body becomes the
        // instructions, and we land in the create form ready to review.
        expect(await screen.findByDisplayValue('Greet Me')).toBeTruthy();
        expect(screen.getByDisplayValue('greet-me')).toBeTruthy();
        expect(screen.getByDisplayValue('Greets warmly')).toBeTruthy();
        expect(screen.getByText('New skill')).toBeTruthy();
        expect(screen.getByRole('button', { name: /Create skill/ })).toBeTruthy();
    });

    test('pre-selects the skill named by initialSelectedId', () => {
        renderSkillsPage({
            personalSkills: [personalSkill],
            sharedSkills: [sharedSkill],
            initialSelectedId: sharedSkill.id,
        });

        // The deep-linked shared skill's detail (its instructions) is shown, not
        // the default first (personal) skill.
        expect(screen.getByTestId('markdown-preview').textContent).toContain('Do release steps');
    });

    test('falls back to the first skill when initialSelectedId matches nothing', () => {
        renderSkillsPage({
            personalSkills: [personalSkill],
            sharedSkills: [sharedSkill],
            initialSelectedId: 'does-not-exist',
        });

        expect(screen.getByTestId('markdown-preview').textContent).toContain('Say hi.');
    });

    test('updates the list when refreshed server props include a new shared skill', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const renderPage = (sharedSkills: SharedAgentSkillCatalogItem[]) => (
            <QueryClientProvider client={queryClient}>
                <TooltipProvider>
                    <SkillsPage
                        initialPersonalSkills={[]}
                        initialSharedSkills={sharedSkills}
                        currentUserEmail="jack@sourcebot.dev"
                        isOwner={true}
                        permissionSyncEnabled={true}
                    />
                </TooltipProvider>
            </QueryClientProvider>
        );

        const { rerender } = render(renderPage([]));
        expect(screen.getByText('No shared skills yet.')).toBeTruthy();

        rerender(renderPage([sharedSkill]));

        await waitFor(() => expect(screen.getByText('Deploy Checklist')).toBeTruthy());
    });

    test('lets an owner jump to workspace settings for a shared skill', async () => {
        renderSkillsPage({ sharedSkills: [sharedSkill], isOwner: true });

        const actionsButton = screen.getByRole('button', { name: 'Actions for Deploy Checklist' });
        actionsButton.focus();
        fireEvent.keyDown(actionsButton, { key: 'Enter' });

        const link = await screen.findByRole('menuitem', { name: /View in workspace settings/ });
        expect(link.getAttribute('href')).toBe('/settings/workspaceAskAgent');
    });

    test('hides the workspace-settings link for a shared skill when not an owner', async () => {
        renderSkillsPage({ sharedSkills: [sharedSkill], isOwner: false });

        const actionsButton = screen.getByRole('button', { name: 'Actions for Deploy Checklist' });
        actionsButton.focus();
        fireEvent.keyDown(actionsButton, { key: 'Enter' });
        // The authoring user can still manage the skill, so the menu opens.
        await screen.findByRole('menuitem', { name: /Delete/ });

        expect(screen.queryByRole('menuitem', { name: /View in workspace settings/ })).toBeNull();
    });

    test('hides the workspace-settings link for a personal skill even for an owner', async () => {
        renderSkillsPage({ personalSkills: [personalSkill], isOwner: true });

        const actionsButton = screen.getByRole('button', { name: 'Actions for Greet Me' });
        actionsButton.focus();
        fireEvent.keyDown(actionsButton, { key: 'Enter' });
        await screen.findByRole('menuitem', { name: /Delete/ });

        expect(screen.queryByRole('menuitem', { name: /View in workspace settings/ })).toBeNull();
    });
});
