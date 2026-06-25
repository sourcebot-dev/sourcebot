'use client';

import { useMemo, useState, type FormEvent } from "react";
import {
    BookOpenIcon,
    Building2Icon,
    CheckIcon,
    Loader2Icon,
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    SearchIcon,
    SparklesIcon,
    StarIcon,
    Trash2Icon,
    Unplug,
} from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    adoptSharedSkill,
    createPersonalAgentSkill,
    deletePersonalAgentSkill,
    deleteSharedAgentSkill,
    makeSharedAgentSkillPersonal,
    publishPersonalAgentSkillToShared,
    unadoptSharedSkill,
    updatePersonalAgentSkill,
    updateSharedAgentSkill,
} from "@/ee/features/chat/skills/actions";
import { SkillInstructionsEditor } from "@/ee/features/chat/skills/components/skillInstructionsEditor";
import {
    AUTO_ENROLLED_SKILL_TOOLTIP,
    DeleteWorkspaceSkillDialog,
    FEATURED_SKILL_TOOLTIP,
    SkillCommandBadge,
    SkillStatusBadge,
} from "@/ee/features/chat/skills/components/workspaceSkillShared";
import {
    normalizeAgentSkillSlug,
    sortAgentSkillListItems,
    sortSharedAgentSkillCatalogItems,
    type AgentSkillInput,
    type AgentSkillListItem,
    type SharedAgentSkillCatalogItem,
} from "@/ee/features/chat/skills/types";
import { useUnsavedChangesGuard } from "@/ee/features/chat/useUnsavedChangesGuard";
import { cn, isServiceError } from "@/lib/utils";

const INSTRUCTIONS_MAX_LENGTH = 20000;
const INSTRUCTIONS_PLACEHOLDER = `Find where a symbol is defined and used across the codebase.

Search for exact matches, related types, tests, and call sites. Prioritize the files most likely to explain the behavior.`;

const emptySkillForm: AgentSkillInput = {
    name: "",
    slug: "",
    description: "",
    instructions: "",
};

// A normalized view of either a personal or shared skill, so the detail pane can
// render both from one shape.
interface DetailSkill {
    id: string;
    scope: "PERSONAL" | "SHARED";
    name: string;
    slug: string;
    description: string;
    instructions: string;
    updatedAt: string;
    addedByEmail: string | null;
    featured: boolean;
    autoEnrolled: boolean;
    isVisibleToUser: boolean;
    isCreatedByUser: boolean;
    canManage: boolean;
}

function toDetailFromPersonal(skill: AgentSkillListItem, currentUserEmail: string): DetailSkill {
    return {
        id: skill.id,
        scope: "PERSONAL",
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        instructions: skill.instructions,
        updatedAt: skill.updatedAt,
        addedByEmail: currentUserEmail,
        featured: false,
        autoEnrolled: false,
        isVisibleToUser: true,
        isCreatedByUser: true,
        canManage: true,
    };
}

function toDetailFromShared(skill: SharedAgentSkillCatalogItem, isOwner: boolean): DetailSkill {
    return {
        id: skill.id,
        scope: "SHARED",
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        instructions: skill.instructions,
        updatedAt: skill.updatedAt,
        addedByEmail: skill.createdByEmail,
        featured: skill.featured,
        autoEnrolled: skill.autoEnrolled,
        isVisibleToUser: skill.isVisibleToUser,
        isCreatedByUser: skill.isCreatedByUser,
        canManage: skill.isCreatedByUser || isOwner,
    };
}

function formatUpdatedAt(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function skillInitial(name: string): string {
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}

function SkillAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
    return (
        <div
            className={cn(
                "flex shrink-0 items-center justify-center rounded-lg bg-muted font-medium text-muted-foreground",
                size === "sm" ? "h-8 w-8 text-sm" : "h-11 w-11 text-base",
            )}
        >
            {skillInitial(name)}
        </div>
    );
}

interface SkillListRowProps {
    name: string;
    slug: string;
    isActive: boolean;
    badge?: React.ReactNode;
    onSelect: () => void;
}

function SkillListRow({ name, slug, isActive, badge, onSelect }: SkillListRowProps) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                isActive ? "bg-muted" : "hover:bg-muted/50",
            )}
        >
            <SkillAvatar name={name} size="sm" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{name}</p>
                    {badge}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">/{slug}</p>
            </div>
        </button>
    );
}

interface SkillsPageProps {
    initialPersonalSkills: AgentSkillListItem[];
    initialSharedSkills: SharedAgentSkillCatalogItem[];
    currentUserEmail: string;
    isOwner: boolean;
}

export function SkillsPage({
    initialPersonalSkills,
    initialSharedSkills,
    currentUserEmail,
    isOwner,
}: SkillsPageProps) {
    const { toast } = useToast();
    const [personalSkills, setPersonalSkills] = useState(() => sortAgentSkillListItems(initialPersonalSkills));
    const [sharedSkills, setSharedSkills] = useState(() => sortSharedAgentSkillCatalogItems(initialSharedSkills));
    const [searchQuery, setSearchQuery] = useState("");

    const [selectedId, setSelectedId] = useState<string | null>(() => {
        const first = sortAgentSkillListItems(initialPersonalSkills)[0] ?? sortSharedAgentSkillCatalogItems(initialSharedSkills)[0];
        return first?.id ?? null;
    });
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState<AgentSkillInput>(emptySkillForm);
    const [isSlugTouched, setIsSlugTouched] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [scopePendingId, setScopePendingId] = useState<string | null>(null);
    const [adoptionPendingId, setAdoptionPendingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [pendingDiscard, setPendingDiscard] = useState<{ run: () => void } | null>(null);
    const [confirmMakePersonal, setConfirmMakePersonal] = useState<DetailSkill | null>(null);
    const [confirmDeletePersonal, setConfirmDeletePersonal] = useState<DetailSkill | null>(null);
    const [confirmDeleteShared, setConfirmDeleteShared] = useState<DetailSkill | null>(null);

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

    const baselineForm: AgentSkillInput = useMemo(() => {
        if (isCreatingNew || !selectedSkill) {
            return emptySkillForm;
        }
        return {
            name: selectedSkill.name,
            slug: selectedSkill.slug,
            description: selectedSkill.description,
            instructions: selectedSkill.instructions,
        };
    }, [isCreatingNew, selectedSkill]);

    const isFormActive = isEditing || isCreatingNew;
    const isDirty = isFormActive && (
        form.name !== baselineForm.name ||
        form.slug !== baselineForm.slug ||
        form.description !== baselineForm.description ||
        form.instructions !== baselineForm.instructions
    );

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
            setForm(emptySkillForm);
            setIsSlugTouched(false);
        });
    };

    const handleStartEdit = () => {
        if (!selectedSkill) {
            return;
        }
        setForm({
            name: selectedSkill.name,
            slug: selectedSkill.slug,
            description: selectedSkill.description,
            instructions: selectedSkill.instructions,
        });
        setIsSlugTouched(true);
        setIsEditing(true);
    };

    const exitFormMode = () => {
        setIsEditing(false);
        setIsCreatingNew(false);
        setForm(emptySkillForm);
        setIsSlugTouched(false);
    };

    const handleCancelEdit = () => {
        guardedTransition(exitFormMode);
    };

    const handleNameChange = (name: string) => {
        setForm((current) => ({
            ...current,
            name,
            slug: isSlugTouched ? current.slug : normalizeAgentSkillSlug(name),
        }));
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

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSaving(true);
        try {
            if (isCreatingNew) {
                const result = await createPersonalAgentSkill(form);
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
                ? await updateSharedAgentSkill({ id: selectedSkill.id, ...form })
                : await updatePersonalAgentSkill({ id: selectedSkill.id, ...form });
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

    const handlePublish = async (skill: DetailSkill) => {
        setScopePendingId(skill.id);
        try {
            const result = await publishPersonalAgentSkillToShared(skill.id);
            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }
            setPersonalSkills((current) => current.filter((item) => item.id !== skill.id));
            setSharedSkills((current) => sortSharedAgentSkillCatalogItems([
                result,
                ...current.filter((item) => item.id !== result.id),
            ]));
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
            const result = await makeSharedAgentSkillPersonal(skill.id);
            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }
            setPersonalSkills((current) => sortAgentSkillListItems([
                result,
                ...current.filter((item) => item.id !== result.id),
            ]));
            if (skill.isCreatedByUser) {
                setSharedSkills((current) => current.filter((item) => item.id !== skill.id));
            } else {
                setSharedSkills((current) => sortSharedAgentSkillCatalogItems(current.map((item) =>
                    item.id === skill.id
                        ? { ...item, isAdopted: false, isRemoved: item.autoEnrolled, isVisibleToUser: false }
                        : item,
                )));
            }
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
            void handlePublish(skill);
            return;
        }
        if (skill.scope === "SHARED" && !shared && skill.canManage) {
            setConfirmMakePersonal(skill);
        }
    };

    const handleAdoptionChange = async (skill: DetailSkill, adopt: boolean) => {
        setAdoptionPendingId(skill.id);
        try {
            const result = adopt
                ? await adoptSharedSkill(skill.id)
                : await unadoptSharedSkill(skill.id);
            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }
            setSharedSkills((current) => sortSharedAgentSkillCatalogItems(current.map((item) =>
                item.id === skill.id
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
            const result = await deletePersonalAgentSkill(skill.id);
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
            const result = await deleteSharedAgentSkill(skill.id);
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
                {/* Master list */}
                <aside className="flex w-[320px] shrink-0 flex-col border-r">
                    <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
                        <h2 className="text-xl font-semibold tracking-tight text-foreground">Skills</h2>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleStartCreate}
                            aria-label="Create skill"
                        >
                            <PlusIcon className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="shrink-0 px-5 pb-3">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search skills..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="h-9 pl-9"
                            />
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
                        <SkillListSection
                            label="Personal"
                            count={filteredPersonal.length}
                            emptyLabel={searchQuery.trim() ? "No matches." : "No personal skills yet."}
                        >
                            {filteredPersonal.map((skill) => (
                                <SkillListRow
                                    key={skill.id}
                                    name={skill.name}
                                    slug={skill.slug}
                                    isActive={selectedId === skill.id && !isCreatingNew}
                                    onSelect={() => handleSelectSkill(skill.id)}
                                />
                            ))}
                        </SkillListSection>

                        <SkillListSection
                            label="Shared"
                            count={filteredShared.length}
                            emptyLabel={searchQuery.trim() ? "No matches." : "No shared skills yet."}
                        >
                            {filteredShared.map((skill) => (
                                <SkillListRow
                                    key={skill.id}
                                    name={skill.name}
                                    slug={skill.slug}
                                    isActive={selectedId === skill.id && !isCreatingNew}
                                    onSelect={() => handleSelectSkill(skill.id)}
                                    badge={
                                        skill.featured ? (
                                            <SkillStatusBadge icon={<StarIcon className="h-3 w-3" />} tooltip={FEATURED_SKILL_TOOLTIP}>
                                                Featured
                                            </SkillStatusBadge>
                                        ) : skill.autoEnrolled ? (
                                            <SkillStatusBadge icon={<SparklesIcon className="h-3 w-3" />} tooltip={AUTO_ENROLLED_SKILL_TOOLTIP}>
                                                Auto
                                            </SkillStatusBadge>
                                        ) : undefined
                                    }
                                />
                            ))}
                        </SkillListSection>
                    </div>
                </aside>

                {/* Detail pane */}
                <section className="flex min-w-0 flex-1 flex-col">
                    {isCreatingNew ? (
                        <SkillEditForm
                            mode="create"
                            form={form}
                            isSaving={isSaving}
                            onNameChange={handleNameChange}
                            onSlugChange={(slug) => { setIsSlugTouched(true); setForm((current) => ({ ...current, slug })); }}
                            onSlugBlur={() => setForm((current) => ({ ...current, slug: normalizeAgentSkillSlug(current.slug) }))}
                            onDescriptionChange={(description) => setForm((current) => ({ ...current, description }))}
                            onInstructionsChange={(instructions) => setForm((current) => ({ ...current, instructions }))}
                            onSubmit={handleSubmit}
                            onCancel={handleCancelEdit}
                            editorKey="new"
                        />
                    ) : selectedSkill === null ? (
                        <SkillsEmptyState onCreate={handleStartCreate} />
                    ) : isEditing ? (
                        <SkillEditForm
                            mode="edit"
                            form={form}
                            isSaving={isSaving}
                            onNameChange={handleNameChange}
                            onSlugChange={(slug) => { setIsSlugTouched(true); setForm((current) => ({ ...current, slug })); }}
                            onSlugBlur={() => setForm((current) => ({ ...current, slug: normalizeAgentSkillSlug(current.slug) }))}
                            onDescriptionChange={(description) => setForm((current) => ({ ...current, description }))}
                            onInstructionsChange={(instructions) => setForm((current) => ({ ...current, instructions }))}
                            onSubmit={handleSubmit}
                            onCancel={handleCancelEdit}
                            editorKey={`edit-${selectedSkill.id}`}
                        />
                    ) : (
                        <SkillDetailView
                            skill={selectedSkill}
                            scopePending={scopePendingId === selectedSkill.id}
                            adoptionPending={adoptionPendingId === selectedSkill.id}
                            onSharedToggle={(shared) => handleSharedToggle(selectedSkill, shared)}
                            onEdit={handleStartEdit}
                            onAdoptionChange={(adopt) => { void handleAdoptionChange(selectedSkill, adopt); }}
                            onMakePersonal={() => setConfirmMakePersonal(selectedSkill)}
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

            {/* Discard-edits confirmation for in-page transitions */}
            <AlertDialog
                open={pendingDiscard !== null}
                onOpenChange={(open) => { if (!open) { setPendingDiscard(null); } }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes to this skill. If you continue, your progress will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPendingDiscard(null)}>Keep editing</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                pendingDiscard?.run();
                                setPendingDiscard(null);
                            }}
                        >
                            Discard changes
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Discard-edits confirmation for cross-page navigation */}
            <AlertDialog
                open={navGuard.active}
                onOpenChange={(open) => { if (!open) { navGuard.resolve(false); } }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes to this skill. If you leave now, your progress will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => navGuard.resolve(false)}>Keep editing</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => navGuard.resolve(true)}
                        >
                            Discard changes
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={confirmMakePersonal !== null}
                onOpenChange={(open) => {
                    if (!open && scopePendingId === null) {
                        setConfirmMakePersonal(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Make Shared Skill Personal</AlertDialogTitle>
                        <AlertDialogDescription>
                            Make <span className="font-semibold text-foreground">{confirmMakePersonal?.name}</span> personal? This removes the <span className="font-mono text-foreground">/{confirmMakePersonal?.slug}</span> command from the shared catalog for everyone and keeps a personal copy for you.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={scopePendingId !== null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={scopePendingId !== null}
                            onClick={(event) => {
                                event.preventDefault();
                                if (confirmMakePersonal) {
                                    void handleMakePersonal(confirmMakePersonal);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {scopePendingId !== null ? "Making personal..." : "Make personal"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={confirmDeletePersonal !== null}
                onOpenChange={(open) => {
                    if (!open && deletingId === null) {
                        setConfirmDeletePersonal(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Skill</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <span className="font-semibold text-foreground">{confirmDeletePersonal?.name}</span>? This will remove the <span className="font-mono text-foreground">/{confirmDeletePersonal?.slug}</span> command.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deletingId !== null}
                            onClick={(event) => {
                                event.preventDefault();
                                if (confirmDeletePersonal) {
                                    void handleDeletePersonal(confirmDeletePersonal);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deletingId !== null ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <DeleteWorkspaceSkillDialog
                skill={confirmDeleteShared}
                isDeleting={deletingId !== null}
                onOpenChange={(open) => {
                    if (!open && deletingId === null) {
                        setConfirmDeleteShared(null);
                    }
                }}
                onConfirm={() => {
                    if (confirmDeleteShared) {
                        void handleDeleteShared(confirmDeleteShared);
                    }
                }}
            />
        </>
    );
}

function SkillListSection({
    label,
    count,
    emptyLabel,
    children,
}: {
    label: string;
    count: number;
    emptyLabel: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{count}</p>
            </div>
            {count === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">{emptyLabel}</p>
            ) : (
                children
            )}
        </div>
    );
}

function SkillsEmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-full bg-muted p-3">
                <BookOpenIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mb-1 text-sm font-medium text-foreground">No skill selected</p>
            <p className="max-w-sm text-sm text-muted-foreground">
                Select a skill to view its details, or create a personal slash-command workflow for Ask Sourcebot.
            </p>
            <Button variant="outline" className="mt-4" onClick={onCreate}>
                <PlusIcon className="mr-2 h-4 w-4" />
                Create skill
            </Button>
        </div>
    );
}

interface SkillDetailViewProps {
    skill: DetailSkill;
    scopePending: boolean;
    adoptionPending: boolean;
    onSharedToggle: (shared: boolean) => void;
    onEdit: () => void;
    onAdoptionChange: (adopt: boolean) => void;
    onMakePersonal: () => void;
    onDelete: () => void;
}

function SkillDetailView({
    skill,
    scopePending,
    adoptionPending,
    onSharedToggle,
    onEdit,
    onAdoptionChange,
    onMakePersonal,
    onDelete,
}: SkillDetailViewProps) {
    const isShared = skill.scope === "SHARED";
    const sharedToggleDisabled = scopePending || (isShared && !skill.canManage);
    const canEdit = skill.canManage;

    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-5 pt-6">
                <div className="flex min-w-0 items-center gap-3">
                    <SkillAvatar name={skill.name} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="truncate text-xl font-semibold tracking-tight text-foreground">{skill.name}</h3>
                            <SkillCommandBadge slug={skill.slug} />
                        </div>
                        {skill.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{skill.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span>Shared</span>
                        {scopePending ? (
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                            <Switch
                                checked={isShared}
                                disabled={sharedToggleDisabled}
                                onCheckedChange={(checked) => onSharedToggle(checked)}
                                aria-label="Shared"
                            />
                        )}
                    </label>
                    {canEdit && (
                        <Button variant="outline" size="sm" onClick={onEdit}>
                            <PencilIcon className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
                    )}
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${skill.name}`}>
                                <MoreHorizontalIcon className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {isShared && (
                                <DropdownMenuItem
                                    disabled={adoptionPending}
                                    onClick={() => onAdoptionChange(!skill.isVisibleToUser)}
                                >
                                    {adoptionPending ? (
                                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                    ) : skill.isVisibleToUser ? (
                                        <Unplug className="mr-2 h-4 w-4" />
                                    ) : (
                                        <PlusIcon className="mr-2 h-4 w-4" />
                                    )}
                                    {skill.isVisibleToUser ? "Remove from my commands" : "Add to my commands"}
                                </DropdownMenuItem>
                            )}
                            {isShared && skill.canManage && (
                                <DropdownMenuItem onClick={onMakePersonal}>
                                    <BookOpenIcon className="mr-2 h-4 w-4" />
                                    Make personal
                                </DropdownMenuItem>
                            )}
                            {skill.canManage && (
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={onDelete}
                                >
                                    <Trash2Icon className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Metadata */}
            <div className="grid shrink-0 grid-cols-1 gap-4 border-t px-6 py-4 sm:grid-cols-3">
                <DetailMetaField label="Visibility">
                    <span className="inline-flex items-center gap-1.5">
                        {isShared ? <Building2Icon className="h-3.5 w-3.5" /> : <BookOpenIcon className="h-3.5 w-3.5" />}
                        {isShared ? "Shared · workspace" : "Personal · only you"}
                    </span>
                </DetailMetaField>
                <DetailMetaField label="Added by">
                    {skill.addedByEmail || "Unknown"}
                </DetailMetaField>
                <DetailMetaField label="Updated">
                    {formatUpdatedAt(skill.updatedAt)}
                </DetailMetaField>
            </div>

            {/* Instructions preview */}
            <div className="flex min-h-0 flex-1 flex-col border-t px-6 py-4">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                    <Label className="text-sm font-semibold">Instructions</Label>
                    <span className="text-xs text-muted-foreground">
                        markdown · {skill.instructions.length.toLocaleString()} / {INSTRUCTIONS_MAX_LENGTH.toLocaleString()}
                    </span>
                </div>
                <div className="min-h-0 flex-1">
                    <SkillInstructionsEditor
                        key={`view-${skill.id}`}
                        value={skill.instructions}
                        onChange={() => undefined}
                        readOnly
                        className="h-full resize-none bg-muted/30 font-mono text-sm leading-relaxed text-muted-foreground"
                    />
                </div>
            </div>
        </div>
    );
}

function DetailMetaField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="truncate text-sm text-foreground">{children}</p>
        </div>
    );
}

interface SkillEditFormProps {
    mode: "create" | "edit";
    form: AgentSkillInput;
    isSaving: boolean;
    onNameChange: (name: string) => void;
    onSlugChange: (slug: string) => void;
    onSlugBlur: () => void;
    onDescriptionChange: (description: string) => void;
    onInstructionsChange: (instructions: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onCancel: () => void;
    editorKey: string;
}

function SkillEditForm({
    mode,
    form,
    isSaving,
    onNameChange,
    onSlugChange,
    onSlugBlur,
    onDescriptionChange,
    onInstructionsChange,
    onSubmit,
    onCancel,
    editorKey,
}: SkillEditFormProps) {
    return (
        <form onSubmit={onSubmit} className="flex h-full min-h-0 flex-col">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 pb-5 pt-6">
                <div className="flex min-w-0 items-center gap-3">
                    <SkillAvatar name={form.name || "?"} />
                    <h3 className="truncate text-xl font-semibold tracking-tight text-foreground">
                        {mode === "create" ? "New skill" : "Edit skill"}
                    </h3>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={isSaving}>
                        {isSaving ? (
                            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <CheckIcon className="mr-2 h-4 w-4" />
                        )}
                        {isSaving ? "Saving..." : mode === "create" ? "Create skill" : "Save skill"}
                    </Button>
                </div>
            </div>

            {/* Fields */}
            <div className="grid shrink-0 grid-cols-1 gap-4 border-t px-6 py-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="skill-name">Name</Label>
                    <Input
                        id="skill-name"
                        value={form.name}
                        onChange={(event) => onNameChange(event.target.value)}
                        placeholder="Find references"
                        maxLength={80}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="skill-command">Command</Label>
                    <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">/</span>
                        <Input
                            id="skill-command"
                            value={form.slug}
                            onChange={(event) => onSlugChange(event.target.value)}
                            onBlur={onSlugBlur}
                            placeholder="find-refs"
                            className="pl-7 font-mono"
                            maxLength={64}
                            required
                        />
                    </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="skill-description">
                        Description
                        <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                        id="skill-description"
                        value={form.description}
                        onChange={(event) => onDescriptionChange(event.target.value)}
                        placeholder="Search for a symbol or API and summarize where it is defined, used, and tested."
                        className="min-h-16 resize-y"
                        maxLength={500}
                    />
                </div>
            </div>

            {/* Instructions */}
            <div className="flex min-h-0 flex-1 flex-col border-t px-6 py-4">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                    <Label htmlFor="skill-instructions" className="text-sm font-semibold">Instructions</Label>
                    <span className="text-xs text-muted-foreground">
                        markdown · {form.instructions.length.toLocaleString()} / {INSTRUCTIONS_MAX_LENGTH.toLocaleString()}
                    </span>
                </div>
                <div className="relative min-h-0 flex-1">
                    <SkillInstructionsEditor
                        key={editorKey}
                        id="skill-instructions"
                        value={form.instructions}
                        onChange={onInstructionsChange}
                        placeholder={INSTRUCTIONS_PLACEHOLDER}
                        className="h-full resize-none font-mono text-sm leading-relaxed"
                    />
                </div>
            </div>
        </form>
    );
}
