'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useToast } from "@/components/hooks/use-toast";
import {
    adoptSharedSkill,
    createPersonalAgentSkill,
    deletePersonalAgentSkill,
    deleteSharedAgentSkill,
    makeSharedAgentSkillPersonal,
    publishPersonalAgentSkillToShared,
    unadoptSharedSkill,
    updatePersonalAgentSkill,
    updatePersonalAgentSkillFromSource,
    updateSharedAgentSkill,
    updateSharedAgentSkillFromSource,
} from "@/ee/features/chat/skills/actions";
import { ImportFromRepoDialog, type ImportedRepoSkill } from "@/ee/features/chat/skills/components/importFromRepoDialog";
import { SkillDetailView } from "@/ee/features/chat/skills/components/skillDetailView";
import { SkillEditForm } from "@/ee/features/chat/skills/components/skillEditForm";
import { SkillsEmptyState } from "@/ee/features/chat/skills/components/skillsEmptyState";
import { SkillsPageDialogs } from "@/ee/features/chat/skills/components/skillsPageDialogs";
import {
    emptySkillForm,
    toDetailFromPersonal,
    toDetailFromShared,
    type DetailSkill,
} from "@/ee/features/chat/skills/components/skillsPageShared";
import { SkillsPageSidebar } from "@/ee/features/chat/skills/components/skillsPageSidebar";
import { useCreateSkillDraftMethod } from "@/ee/features/chat/skills/components/useCreateSkillDraftMethod";
import {
    parseAgentSkillMarkdown,
    sortAgentSkillListItems,
    sortSharedAgentSkillCatalogItems,
    type AgentSkillInput,
    type AgentSkillListItem,
    type ParsedAgentSkillMarkdown,
    type SharedAgentSkillCatalogItem,
} from "@/ee/features/chat/skills/types";
import { useUnsavedChangesGuard } from "@/ee/features/chat/useUnsavedChangesGuard";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { isServiceError } from "@/lib/utils";

interface SkillsPageProps {
    initialPersonalSkills: AgentSkillListItem[];
    initialSharedSkills: SharedAgentSkillCatalogItem[];
    currentUserEmail: string;
    isOwner: boolean;
    // Deep-link a skill as the initially-selected one (e.g. from the workspace
    // admin table). Ignored when it doesn't match a skill visible on this page.
    initialSelectedId?: string;
    // Whether repository permission syncing is enabled. When off, every member
    // sees every repo, so sharing a synced skill carries no access caveat and
    // skips the confirmation dialog.
    permissionSyncEnabled: boolean;
}

export function SkillsPage({
    initialPersonalSkills,
    initialSharedSkills,
    currentUserEmail,
    isOwner,
    initialSelectedId,
    permissionSyncEnabled,
}: SkillsPageProps) {
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();
    const [personalSkills, setPersonalSkills] = useState(() => sortAgentSkillListItems(initialPersonalSkills));
    const [sharedSkills, setSharedSkills] = useState(() => sortSharedAgentSkillCatalogItems(initialSharedSkills));
    const [searchQuery, setSearchQuery] = useState("");
    const didCapturePageViewRef = useRef(false);

    useEffect(() => {
        setPersonalSkills(sortAgentSkillListItems(initialPersonalSkills));
    }, [initialPersonalSkills]);

    useEffect(() => {
        setSharedSkills(sortSharedAgentSkillCatalogItems(initialSharedSkills));
    }, [initialSharedSkills]);

    const [selectedId, setSelectedId] = useState<string | null>(() => {
        // Honor a deep-linked selection, but only when it matches a skill visible
        // on this page; otherwise fall back to the first skill.
        if (initialSelectedId
            && (initialPersonalSkills.some((skill) => skill.id === initialSelectedId)
                || initialSharedSkills.some((skill) => skill.id === initialSelectedId))) {
            return initialSelectedId;
        }
        const first = sortAgentSkillListItems(initialPersonalSkills)[0] ?? sortSharedAgentSkillCatalogItems(initialSharedSkills)[0];
        return first?.id ?? null;
    });
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [draftInitialForm, setDraftInitialForm] = useState<AgentSkillInput>(emptySkillForm);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const {
        createDraftMethod,
        markManualDraft,
        markLocalMarkdownDraft,
        resetDraftMethod,
    } = useCreateSkillDraftMethod();
    const [initialSlugTouched, setInitialSlugTouched] = useState(false);
    // Bumped whenever we enter create mode or import, to remount the (uncontrolled)
    // instructions editor with fresh content.
    const [createEditorNonce, setCreateEditorNonce] = useState(0);
    const markdownFileInputRef = useRef<HTMLInputElement>(null);
    const [isRepoImportOpen, setIsRepoImportOpen] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [scopePendingId, setScopePendingId] = useState<string | null>(null);
    const [adoptionPendingId, setAdoptionPendingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [sourceUpdatePendingId, setSourceUpdatePendingId] = useState<string | null>(null);

    const [pendingDiscard, setPendingDiscard] = useState<{ run: () => void } | null>(null);
    const [confirmMakePersonal, setConfirmMakePersonal] = useState<DetailSkill | null>(null);
    const [confirmPublishSynced, setConfirmPublishSynced] = useState<DetailSkill | null>(null);
    const [confirmDeletePersonal, setConfirmDeletePersonal] = useState<DetailSkill | null>(null);
    const [confirmDeleteShared, setConfirmDeleteShared] = useState<DetailSkill | null>(null);

    useEffect(() => {
        if (didCapturePageViewRef.current) {
            return;
        }
        didCapturePageViewRef.current = true;
        captureEvent('ask_skills_page_viewed', {
            source: 'sourcebot-web-client',
            entryPoint: 'skills_settings',
            personalSkillCount: personalSkills.length,
            sharedSkillCount: sharedSkills.length,
            visibleSharedSkillCount: sharedSkills.filter((skill) => skill.isVisibleToUser).length,
            adoptedSharedSkillCount: sharedSkills.filter((skill) => skill.isAdopted).length,
            syncedSkillCount: [
                ...personalSkills,
                ...sharedSkills,
            ].filter((skill) => skill.source !== null).length,
            isOwner,
            permissionSyncEnabled,
        });
    }, [captureEvent, isOwner, permissionSyncEnabled, personalSkills, sharedSkills]);

    const selectedSkill: DetailSkill | null = useMemo(() => {
        if (selectedId === null) {
            return null;
        }
        const personal = personalSkills.find((skill) => skill.id === selectedId);
        if (personal) {
            return toDetailFromPersonal(personal, currentUserEmail);
        }
        const shared = sharedSkills.find((skill) => skill.id === selectedId);
        if (shared) {
            return toDetailFromShared(shared, isOwner);
        }
        return null;
    }, [selectedId, personalSkills, sharedSkills, currentUserEmail, isOwner]);

    const isFormActive = isEditing || isCreatingNew;
    const isDirty = isFormActive && isFormDirty;

    // Intercept cross-page navigation (sidebar links, browser back) while there
    // are unsaved edits, and resolve it through the themed dialog below.
    const navGuard = useUnsavedChangesGuard({ enabled: isDirty });

    // In-page transitions (selecting another skill, starting a new draft) are
    // local state, not router navigation, so they bypass `navGuard`. Route them
    // through this helper to confirm discarding unsaved edits first.
    const guardedTransition = (run: () => void) => {
        if (isDirty) {
            setPendingDiscard({ run });
            return;
        }
        run();
    };

    const handleSelectSkill = (id: string) => {
        if (id === selectedId && !isFormActive) {
            return;
        }
        guardedTransition(() => {
            setSelectedId(id);
            setIsEditing(false);
            setIsCreatingNew(false);
        });
    };

    const handleStartCreate = () => {
        guardedTransition(() => {
            setIsCreatingNew(true);
            setIsEditing(false);
            setSelectedId(null);
            setDraftInitialForm(emptySkillForm);
            markManualDraft();
            setInitialSlugTouched(false);
            setIsFormDirty(false);
            setCreateEditorNonce((nonce) => nonce + 1);
        });
    };

    // Drop into the create form pre-populated from a parsed markdown skill (a local
    // file or a repository file): front matter fills name, command, and description,
    // and the body becomes the instructions, so the user can review before saving.
    const applyImportedSkillMarkdown = (parsed: ParsedAgentSkillMarkdown) => {
        guardedTransition(() => {
            setIsCreatingNew(true);
            setIsEditing(false);
            setSelectedId(null);
            setDraftInitialForm({
                name: parsed.name ?? "",
                slug: parsed.slug ?? "",
                description: parsed.description ?? "",
                instructions: parsed.instructions,
            });
            markLocalMarkdownDraft();
            setInitialSlugTouched(Boolean(parsed.slug || parsed.name));
            setIsFormDirty(false);
            setCreateEditorNonce((nonce) => nonce + 1);
            toast({
                title: parsed.frontmatterError ? "Front matter issue" : undefined,
                description: parsed.frontmatterError
                    ? `Markdown skill imported. ${parsed.frontmatterError}`
                    : "Markdown skill imported.",
                variant: parsed.frontmatterError ? "destructive" : undefined,
            });
        });
    };

    // Repository imports create a read-only skill that stays linked to its source
    // file, so (unlike file import) we create it directly rather than dropping into
    // the editable form. The repo → file navigation is itself the confirmation.
    const handleImportRepoSkill = (imported: ImportedRepoSkill) => {
        guardedTransition(() => { void createSkillFromRepo(imported); });
    };

    const createSkillFromRepo = async (imported: ImportedRepoSkill) => {
        const result = await createPersonalAgentSkill({
            name: imported.parsed.name ?? "",
            slug: imported.parsed.slug ?? "",
            description: imported.parsed.description ?? "",
            instructions: imported.parsed.instructions,
            source: imported.source,
        }, {
            entryPoint: 'skills_settings',
            creationMethod: 'repository',
        });
        if (isServiceError(result)) {
            toast({ title: "Error", description: result.message, variant: "destructive" });
            return;
        }
        setPersonalSkills((current) => sortAgentSkillListItems([result, ...current.filter((item) => item.id !== result.id)]));
        exitFormMode();
        setSelectedId(result.id);
        toast({
            title: imported.parsed.frontmatterError ? "Front matter issue" : undefined,
            description: imported.parsed.frontmatterError
                ? `Skill imported from repository. ${imported.parsed.frontmatterError}`
                : "Skill imported from repository.",
            variant: imported.parsed.frontmatterError ? "destructive" : undefined,
        });
    };

    const handleUpdateFromSource = async (skill: DetailSkill) => {
        setSourceUpdatePendingId(skill.id);
        try {
            if (skill.scope === "SHARED") {
                const result = await updateSharedAgentSkillFromSource(skill.id, { entryPoint: 'skills_settings' });
                if (isServiceError(result)) {
                    toast({ title: "Error", description: result.message, variant: "destructive" });
                    return;
                }
                setSharedSkills((current) => sortSharedAgentSkillCatalogItems(current.map((item) =>
                    item.id === result.id ? result : item,
                )));
            } else {
                const result = await updatePersonalAgentSkillFromSource(skill.id, { entryPoint: 'skills_settings' });
                if (isServiceError(result)) {
                    toast({ title: "Error", description: result.message, variant: "destructive" });
                    return;
                }
                setPersonalSkills((current) => sortAgentSkillListItems(current.map((item) =>
                    item.id === result.id ? result : item,
                )));
            }
            toast({ description: "Skill updated from source." });
        } catch {
            toast({ title: "Error", description: "Failed to update from source.", variant: "destructive" });
        } finally {
            setSourceUpdatePendingId(null);
        }
    };

    const triggerMarkdownImport = () => {
        markdownFileInputRef.current?.click();
    };

    const handleImportMarkdownFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        input.value = "";

        if (!file) {
            return;
        }

        if (!/\.(md|markdown)$/i.test(file.name)) {
            captureEvent('ask_skill_import_completed', {
                source: 'sourcebot-web-client',
                entryPoint: 'skills_settings',
                method: 'local_markdown',
                isSynced: false,
                success: false,
                failureReason: 'unsupported_file_type',
            });
            toast({ title: "Unsupported file", description: "Choose a markdown file ending in .md or .markdown.", variant: "destructive" });
            return;
        }

        let text: string;
        try {
            text = await file.text();
        } catch {
            captureEvent('ask_skill_import_completed', {
                source: 'sourcebot-web-client',
                entryPoint: 'skills_settings',
                method: 'local_markdown',
                isSynced: false,
                success: false,
                failureReason: 'file_read_error',
            });
            toast({ title: "Error", description: "Failed to import markdown file.", variant: "destructive" });
            return;
        }

        const parsed = parseAgentSkillMarkdown(text, file.name);
        captureEvent('ask_skill_import_completed', {
            source: 'sourcebot-web-client',
            entryPoint: 'skills_settings',
            method: 'local_markdown',
            isSynced: false,
            hasFrontmatter: parsed.hasFrontmatter,
            hasDescription: Boolean(parsed.description),
            success: true,
        });
        applyImportedSkillMarkdown(parsed);
    };

    const handleStartEdit = () => {
        if (!selectedSkill) {
            return;
        }
        setDraftInitialForm({
            name: selectedSkill.name,
            slug: selectedSkill.slug,
            description: selectedSkill.description,
            instructions: selectedSkill.instructions,
        });
        setInitialSlugTouched(true);
        setIsFormDirty(false);
        setIsEditing(true);
    };

    const exitFormMode = () => {
        setIsEditing(false);
        setIsCreatingNew(false);
        setDraftInitialForm(emptySkillForm);
        resetDraftMethod();
        setInitialSlugTouched(false);
        setIsFormDirty(false);
    };

    const handleCancelEdit = () => {
        guardedTransition(exitFormMode);
    };

    // Replace a shared skill in local state, preserving catalog-only flags that
    // the edit action does not return.
    const mergeSharedSkill = (id: string, updated: AgentSkillListItem) => {
        setSharedSkills((current) => sortSharedAgentSkillCatalogItems(current.map((item) =>
            item.id === id
                ? {
                    ...item,
                    name: updated.name,
                    slug: updated.slug,
                    description: updated.description,
                    instructions: updated.instructions,
                    updatedAt: updated.updatedAt,
                }
                : item,
        )));
    };

    const handleSubmit = async (values: AgentSkillInput) => {
        setIsSaving(true);
        try {
            if (isCreatingNew) {
                const result = await createPersonalAgentSkill(values, {
                    entryPoint: 'skills_settings',
                    creationMethod: createDraftMethod,
                });
                if (isServiceError(result)) {
                    toast({ title: "Error", description: result.message, variant: "destructive" });
                    return;
                }
                setPersonalSkills((current) => sortAgentSkillListItems([result, ...current]));
                exitFormMode();
                setSelectedId(result.id);
                toast({ description: "Skill created." });
                return;
            }

            if (!selectedSkill) {
                return;
            }

            const result = selectedSkill.scope === "SHARED"
                ? await updateSharedAgentSkill({ id: selectedSkill.id, ...values }, { entryPoint: 'skills_settings' })
                : await updatePersonalAgentSkill({ id: selectedSkill.id, ...values }, { entryPoint: 'skills_settings' });
            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }

            if (selectedSkill.scope === "SHARED") {
                mergeSharedSkill(selectedSkill.id, result);
            } else {
                setPersonalSkills((current) => sortAgentSkillListItems(current.map((item) =>
                    item.id === result.id ? result : item,
                )));
            }
            exitFormMode();
            toast({ description: "Skill updated." });
        } catch {
            toast({ title: "Error", description: "Failed to save skill.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInvalidSubmit = () => {
        toast({
            title: "Fix validation errors",
            description: "Review the highlighted fields before saving.",
            variant: "destructive",
        });
    };

    const handlePublish = async (skill: DetailSkill) => {
        setScopePendingId(skill.id);
        try {
            const result = await publishPersonalAgentSkillToShared(skill.id, { entryPoint: 'skills_settings' });
            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }
            setPersonalSkills((current) => current.filter((item) => item.id !== skill.id));
            setSharedSkills((current) => sortSharedAgentSkillCatalogItems([
                result,
                ...current.filter((item) => item.id !== result.id),
            ]));
            setConfirmPublishSynced(null);
            setSelectedId(result.id);
            toast({ description: "Skill shared with your workspace." });
        } catch {
            toast({ title: "Error", description: "Failed to publish skill.", variant: "destructive" });
        } finally {
            setScopePendingId(null);
        }
    };

    const handleMakePersonal = async (skill: DetailSkill) => {
        setScopePendingId(skill.id);
        try {
            const result = await makeSharedAgentSkillPersonal(skill.id, { entryPoint: 'skills_settings' });
            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }
            setPersonalSkills((current) => sortAgentSkillListItems([
                result,
                ...current.filter((item) => item.id !== result.id),
            ]));
            setSharedSkills((current) => current.filter((item) => item.id !== skill.id));
            setConfirmMakePersonal(null);
            setSelectedId(result.id);
            toast({ description: "Skill made personal." });
        } catch {
            toast({ title: "Error", description: "Failed to make skill personal.", variant: "destructive" });
        } finally {
            setScopePendingId(null);
        }
    };

    // The header "Shared" toggle switches a skill's scope: a personal skill is
    // published to the workspace catalog; a shared skill the user can manage is
    // made personal again (behind a confirm). It is disabled for shared skills
    // created by others.
    const handleSharedToggle = (skill: DetailSkill, shared: boolean) => {
        if (scopePendingId !== null) {
            return;
        }
        if (skill.scope === "PERSONAL" && shared) {
            // Sharing a synced skill widens who can reach its repo-derived content,
            // so confirm first — but only when permission syncing is on. With
            // syncing off every member already sees every repo, so there's no
            // access caveat to warn about and it publishes immediately, like a
            // plain personal skill.
            if (skill.source && permissionSyncEnabled) {
                setConfirmPublishSynced(skill);
            } else {
                void handlePublish(skill);
            }
            return;
        }
        if (skill.scope === "SHARED" && !shared && skill.canManage) {
            setConfirmMakePersonal(skill);
        }
    };

    const handleAdoptionChange = async (skillId: string, adopt: boolean) => {
        setAdoptionPendingId(skillId);
        try {
            const result = adopt
                ? await adoptSharedSkill(skillId, { entryPoint: 'skills_settings' })
                : await unadoptSharedSkill(skillId, { entryPoint: 'skills_settings' });
            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }
            setSharedSkills((current) => sortSharedAgentSkillCatalogItems(current.map((item) =>
                item.id === skillId
                    ? {
                        ...item,
                        isAdopted: adopt,
                        isRemoved: adopt ? false : item.autoEnrolled,
                        isVisibleToUser: adopt,
                    }
                    : item,
            )));
            toast({ description: adopt ? "Skill added to your commands." : "Skill removed from your commands." });
        } catch {
            toast({ title: "Error", description: "Failed to update skill.", variant: "destructive" });
        } finally {
            setAdoptionPendingId(null);
        }
    };

    const handleDeletePersonal = async (skill: DetailSkill) => {
        setDeletingId(skill.id);
        try {
            const result = await deletePersonalAgentSkill(skill.id, { entryPoint: 'skills_settings' });
            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }
            setPersonalSkills((current) => current.filter((item) => item.id !== skill.id));
            setConfirmDeletePersonal(null);
            if (selectedId === skill.id) {
                setSelectedId(null);
            }
            toast({ description: "Skill deleted." });
        } catch {
            toast({ title: "Error", description: "Failed to delete skill.", variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteShared = async (skill: DetailSkill) => {
        setDeletingId(skill.id);
        try {
            const result = await deleteSharedAgentSkill(skill.id, { entryPoint: 'skills_settings' });
            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }
            setSharedSkills((current) => current.filter((item) => item.id !== skill.id));
            setConfirmDeleteShared(null);
            if (selectedId === skill.id) {
                setSelectedId(null);
            }
            toast({ description: "Shared skill deleted." });
        } catch {
            toast({ title: "Error", description: "Failed to delete shared skill.", variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    };

    const filteredPersonal = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) {
            return personalSkills;
        }
        return personalSkills.filter((skill) =>
            skill.name.toLowerCase().includes(q) || skill.slug.toLowerCase().includes(q));
    }, [personalSkills, searchQuery]);

    const filteredShared = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) {
            return sharedSkills;
        }
        return sharedSkills.filter((skill) =>
            skill.name.toLowerCase().includes(q) || skill.slug.toLowerCase().includes(q));
    }, [sharedSkills, searchQuery]);

    return (
        <>
            <div className="flex h-full min-h-0">
                <SkillsPageSidebar
                    filteredPersonal={filteredPersonal}
                    filteredShared={filteredShared}
                    searchQuery={searchQuery}
                    selectedId={selectedId}
                    isCreatingNew={isCreatingNew}
                    adoptionPendingId={adoptionPendingId}
                    markdownFileInputRef={markdownFileInputRef}
                    onSearchQueryChange={setSearchQuery}
                    onImportMarkdownFile={handleImportMarkdownFile}
                    onStartCreate={handleStartCreate}
                    onTriggerMarkdownImport={triggerMarkdownImport}
                    onOpenRepoImport={() => setIsRepoImportOpen(true)}
                    onSelectSkill={handleSelectSkill}
                    onAdoptionChange={(skillId, adopt) => void handleAdoptionChange(skillId, adopt)}
                />

                <section className="flex min-w-0 flex-1 flex-col">
                    {isCreatingNew ? (
                        <SkillEditForm
                            mode="create"
                            initialForm={draftInitialForm}
                            isSaving={isSaving}
                            initialSlugTouched={initialSlugTouched}
                            onDirtyChange={setIsFormDirty}
                            onSubmit={handleSubmit}
                            onInvalidSubmit={handleInvalidSubmit}
                            onCancel={handleCancelEdit}
                            editorKey={`new-${createEditorNonce}`}
                        />
                    ) : selectedSkill === null ? (
                        <SkillsEmptyState onCreate={handleStartCreate} />
                    ) : isEditing ? (
                        <SkillEditForm
                            mode="edit"
                            initialForm={draftInitialForm}
                            isSaving={isSaving}
                            lockedSource={selectedSkill.source}
                            initialSlugTouched={initialSlugTouched}
                            onDirtyChange={setIsFormDirty}
                            onSubmit={handleSubmit}
                            onInvalidSubmit={handleInvalidSubmit}
                            onCancel={handleCancelEdit}
                            editorKey={`edit-${selectedSkill.id}`}
                        />
                    ) : (
                        <SkillDetailView
                            skill={selectedSkill}
                            workspaceAdminHref={
                                isOwner && selectedSkill.scope === "SHARED"
                                    ? "/settings/workspaceAskAgent"
                                    : undefined
                            }
                            scopePending={scopePendingId === selectedSkill.id}
                            sourceUpdatePending={sourceUpdatePendingId === selectedSkill.id}
                            onSharedToggle={(shared) => handleSharedToggle(selectedSkill, shared)}
                            onEdit={handleStartEdit}
                            onUpdateFromSource={() => void handleUpdateFromSource(selectedSkill)}
                            onDelete={() => {
                                if (selectedSkill.scope === "SHARED") {
                                    setConfirmDeleteShared(selectedSkill);
                                } else {
                                    setConfirmDeletePersonal(selectedSkill);
                                }
                            }}
                        />
                    )}
                </section>
            </div>

            <ImportFromRepoDialog
                open={isRepoImportOpen}
                onOpenChange={setIsRepoImportOpen}
                onImport={handleImportRepoSkill}
                onError={(message) => toast({ title: "Error", description: message, variant: "destructive" })}
            />

            <SkillsPageDialogs
                pendingDiscard={pendingDiscard}
                navGuardActive={navGuard.active}
                confirmMakePersonal={confirmMakePersonal}
                confirmPublishSynced={confirmPublishSynced}
                confirmDeletePersonal={confirmDeletePersonal}
                confirmDeleteShared={confirmDeleteShared}
                scopePendingId={scopePendingId}
                deletingId={deletingId}
                onCancelPendingDiscard={() => setPendingDiscard(null)}
                onConfirmPendingDiscard={() => {
                    pendingDiscard?.run();
                    setPendingDiscard(null);
                }}
                onCancelNavigation={() => navGuard.resolve(false)}
                onConfirmNavigation={() => navGuard.resolve(true)}
                onCloseMakePersonal={() => setConfirmMakePersonal(null)}
                onConfirmMakePersonal={(skill) => void handleMakePersonal(skill)}
                onClosePublishSynced={() => setConfirmPublishSynced(null)}
                onConfirmPublishSynced={(skill) => void handlePublish(skill)}
                onCloseDeletePersonal={() => setConfirmDeletePersonal(null)}
                onConfirmDeletePersonal={(skill) => void handleDeletePersonal(skill)}
                onCloseDeleteShared={() => setConfirmDeleteShared(null)}
                onConfirmDeleteShared={() => {
                    if (confirmDeleteShared) {
                        void handleDeleteShared(confirmDeleteShared);
                    }
                }}
            />
        </>
    );
}
