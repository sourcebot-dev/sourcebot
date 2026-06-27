'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
    BookOpenIcon,
    Building2Icon,
    CheckIcon,
    FolderGit2Icon,
    ListIcon,
    Loader2Icon,
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    SearchIcon,
    Trash2Icon,
    UploadIcon,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { ImportFromRepoDialog } from "@/ee/features/chat/skills/components/importFromRepoDialog";
import { MarkdownRenderer } from "@/ee/features/chat/components/chatThread/markdownRenderer";
import { TableOfContents } from "@/ee/features/chat/components/chatThread/tableOfContents";
import { useExtractTOCItems } from "@/ee/features/chat/useTOCItems";
import {
    AutoEnrolledSkillBadge,
    DeleteWorkspaceSkillDialog,
    SkillCommandBadge,
} from "@/ee/features/chat/skills/components/workspaceSkillShared";
import {
    normalizeAgentSkillSlug,
    parseAgentSkillMarkdown,
    sortAgentSkillListItems,
    sortSharedAgentSkillCatalogItems,
    type AgentSkillInput,
    type AgentSkillListItem,
    type ParsedAgentSkillMarkdown,
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
    enabled?: boolean;
    togglePending?: boolean;
    onToggleEnabled?: (checked: boolean) => void;
    onSelect: () => void;
}

function SkillListRow({ name, slug, isActive, badge, enabled, togglePending, onToggleEnabled, onSelect }: SkillListRowProps) {
    return (
        <div
            className={cn(
                "flex items-center rounded-lg transition-colors",
                isActive ? "bg-muted" : "hover:bg-muted/50",
            )}
        >
            <button
                type="button"
                onClick={onSelect}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left"
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
            {onToggleEnabled && (
                <Switch
                    checked={!!enabled}
                    disabled={togglePending}
                    onCheckedChange={onToggleEnabled}
                    aria-label={`Enable ${name}`}
                    className={cn(
                        "mr-3 shrink-0",
                        "data-[state=unchecked]:bg-muted-foreground/40 data-[state=unchecked]:border-muted-foreground/70",
                        "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600",
                        "[&>span]:bg-foreground",
                    )}
                />
            )}
        </div>
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
    // Bumped whenever we enter create mode or import, to remount the (uncontrolled)
    // instructions editor with fresh content.
    const [createEditorNonce, setCreateEditorNonce] = useState(0);
    const markdownFileInputRef = useRef<HTMLInputElement>(null);
    const [isRepoImportOpen, setIsRepoImportOpen] = useState(false);

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
            setForm({
                name: parsed.name ?? "",
                slug: parsed.slug ?? "",
                description: parsed.description ?? "",
                instructions: parsed.instructions,
            });
            setIsSlugTouched(Boolean(parsed.slug || parsed.name));
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
            toast({ title: "Unsupported file", description: "Choose a markdown file ending in .md or .markdown.", variant: "destructive" });
            return;
        }

        let text: string;
        try {
            text = await file.text();
        } catch {
            toast({ title: "Error", description: "Failed to import markdown file.", variant: "destructive" });
            return;
        }

        applyImportedSkillMarkdown(parseAgentSkillMarkdown(text, file.name));
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

    const handleAdoptionChange = async (skillId: string, adopt: boolean) => {
        setAdoptionPendingId(skillId);
        try {
            const result = adopt
                ? await adoptSharedSkill(skillId)
                : await unadoptSharedSkill(skillId);
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
                        <input
                            ref={markdownFileInputRef}
                            type="file"
                            accept=".md,.markdown,text/markdown,text/plain"
                            className="hidden"
                            onChange={handleImportMarkdownFile}
                        />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label="Add skill"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleStartCreate}>
                                    <PlusIcon className="mr-2 h-4 w-4" />
                                    New skill
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={triggerMarkdownImport}>
                                    <UploadIcon className="mr-2 h-4 w-4" />
                                    Import from file
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsRepoImportOpen(true)}>
                                    <FolderGit2Icon className="mr-2 h-4 w-4" />
                                    Import from repository
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                                    enabled={skill.isVisibleToUser}
                                    togglePending={adoptionPendingId === skill.id}
                                    onToggleEnabled={(checked) => void handleAdoptionChange(skill.id, checked)}
                                    badge={
                                        skill.autoEnrolled ? (
                                            <AutoEnrolledSkillBadge />
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
                            isDirty={isDirty}
                            onNameChange={handleNameChange}
                            onSlugChange={(slug) => { setIsSlugTouched(true); setForm((current) => ({ ...current, slug })); }}
                            onSlugBlur={() => setForm((current) => ({ ...current, slug: normalizeAgentSkillSlug(current.slug) }))}
                            onDescriptionChange={(description) => setForm((current) => ({ ...current, description }))}
                            onInstructionsChange={(instructions) => setForm((current) => ({ ...current, instructions }))}
                            onSubmit={handleSubmit}
                            onCancel={handleCancelEdit}
                            editorKey={`new-${createEditorNonce}`}
                        />
                    ) : selectedSkill === null ? (
                        <SkillsEmptyState onCreate={handleStartCreate} />
                    ) : isEditing ? (
                        <SkillEditForm
                            mode="edit"
                            form={form}
                            isSaving={isSaving}
                            isDirty={isDirty}
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
                            onSharedToggle={(shared) => handleSharedToggle(selectedSkill, shared)}
                            onEdit={handleStartEdit}
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

            <ImportFromRepoDialog
                open={isRepoImportOpen}
                onOpenChange={setIsRepoImportOpen}
                onImport={applyImportedSkillMarkdown}
                onError={(message) => toast({ title: "Error", description: message, variant: "destructive" })}
            />

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
    onSharedToggle: (shared: boolean) => void;
    onEdit: () => void;
    onMakePersonal: () => void;
    onDelete: () => void;
}

function SkillDetailView({
    skill,
    scopePending,
    onSharedToggle,
    onEdit,
    onMakePersonal,
    onDelete,
}: SkillDetailViewProps) {
    const isShared = skill.scope === "SHARED";
    const canManage = skill.canManage;
    const sharedToggleDisabled = scopePending || (isShared && !canManage);

    // Track the rendered-markdown element via state (not a plain ref) so the TOC
    // hook re-runs once it mounts. The detail view is static after selection, so a
    // ref's `.current` would still read null on the render the hook depends on.
    const [instructionsEl, setInstructionsEl] = useState<HTMLDivElement | null>(null);
    const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
    const [outlineOpen, setOutlineOpen] = useState(false);
    const { tocItems, activeId } = useExtractTOCItems({ target: instructionsEl, root: scrollEl });

    return (
        <div className="@container flex h-full min-h-0 flex-col">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-6 border-b px-6 pb-5 pt-6">
                <div className="flex min-w-0 max-w-5xl items-center gap-3">
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
                {canManage && (
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
                        <Button variant="outline" size="sm" onClick={onEdit}>
                            <PencilIcon className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${skill.name}`}>
                                    <MoreHorizontalIcon className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {isShared && (
                                    <DropdownMenuItem onClick={onMakePersonal}>
                                        <BookOpenIcon className="mr-2 h-4 w-4" />
                                        Make personal
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={onDelete}
                                >
                                    <Trash2Icon className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            {/* Metadata folds to chips until the pane is wide enough for the right rail. */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-6 py-3 @6xl:hidden">
                <SkillMetaChips skill={skill} />
            </div>

            {/* Body: outline rail · reading column · metadata rail */}
            <div className="flex min-h-0 flex-1 gap-6 px-6 py-4">
                {tocItems.length > 0 && (
                    <div className="hidden w-48 shrink-0 overflow-y-auto @3xl:block">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            On this page
                        </p>
                        <TableOfContents tocItems={tocItems} activeId={activeId} />
                    </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="mx-auto flex min-h-0 w-full max-w-[85ch] flex-1 flex-col">
                        <div className="mb-3 flex items-center gap-2">
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">markdown</span>
                            <span className="text-xs text-muted-foreground">
                                {skill.instructions.length.toLocaleString()} / {INSTRUCTIONS_MAX_LENGTH.toLocaleString()}
                            </span>
                            {tocItems.length > 0 && (
                                <Popover open={outlineOpen} onOpenChange={setOutlineOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="ml-auto h-7 gap-1.5 @3xl:hidden">
                                            <ListIcon className="h-3.5 w-3.5" />
                                            On this page
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="max-h-80 w-64 overflow-y-auto p-2">
                                        <div onClick={() => setOutlineOpen(false)}>
                                            <TableOfContents tocItems={tocItems} activeId={activeId} />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                        <div ref={setScrollEl} className="min-h-0 flex-1 overflow-y-auto rounded-md bg-muted/20 px-4 py-3">
                            <MarkdownRenderer
                                key={`view-${skill.id}`}
                                ref={setInstructionsEl}
                                content={skill.instructions}
                                escapeHtml
                                className="prose-sm prose-headings:scroll-mt-3 max-w-none"
                            />
                        </div>
                    </div>
                </div>
                <div className="hidden w-72 shrink-0 @6xl:block">
                    <div className="space-y-4 rounded-lg border bg-card p-4">
                        <SkillDetailMetaFields skill={skill} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function SkillMetaChips({ skill }: { skill: DetailSkill }) {
    const isShared = skill.scope === "SHARED";
    const chipClass = "inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground";
    return (
        <>
            <span className={chipClass}>
                {isShared ? <Building2Icon className="h-3.5 w-3.5" /> : <BookOpenIcon className="h-3.5 w-3.5" />}
                {isShared ? "Shared · workspace" : "Personal · only you"}
            </span>
            <span className={chipClass}>{skill.addedByEmail || "Unknown"}</span>
            <span className={chipClass}>Updated {formatUpdatedAt(skill.updatedAt)}</span>
        </>
    );
}

function SkillDetailMetaFields({ skill }: { skill: DetailSkill }) {
    const isShared = skill.scope === "SHARED";
    return (
        <>
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
        </>
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

type InstructionsView = "write" | "split" | "preview";

interface SkillEditFormProps {
    mode: "create" | "edit";
    form: AgentSkillInput;
    isSaving: boolean;
    isDirty: boolean;
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
    isDirty,
    onNameChange,
    onSlugChange,
    onSlugBlur,
    onDescriptionChange,
    onInstructionsChange,
    onSubmit,
    onCancel,
    editorKey,
}: SkillEditFormProps) {
    const [instructionsView, setInstructionsView] = useState<InstructionsView>("write");
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                formRef.current?.requestSubmit();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <form ref={formRef} onSubmit={onSubmit} className="flex h-full min-h-0 flex-col">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 pb-5 pt-6">
                <div className="flex min-w-0 items-center gap-3">
                    <SkillAvatar name={form.name || "?"} />
                    <h3 className="truncate text-xl font-semibold tracking-tight text-foreground">
                        {mode === "create" ? "New skill" : "Edit skill"}
                    </h3>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    {isDirty && !isSaving && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Unsaved changes
                        </span>
                    )}
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
                        {!isSaving && (
                            <kbd className="ml-2 font-sans text-xs font-normal text-primary-foreground/60">⌘S</kbd>
                        )}
                    </Button>
                </div>
            </div>

            {/* Fields */}
            <div className="mx-auto grid w-full max-w-5xl shrink-0 grid-cols-1 gap-4 px-6 pt-6 sm:grid-cols-[3fr_2fr]">
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
            <div className="flex w-full min-h-0 flex-1 flex-col pb-6 pt-6">
                <div className="mx-auto mb-3 flex w-full max-w-5xl items-center justify-between gap-2 px-6">
                    <div className="flex items-center gap-3">
                        <Label htmlFor="skill-instructions" className="text-sm font-semibold">Instructions</Label>
                        <ToggleGroup
                            type="single"
                            value={instructionsView}
                            onValueChange={(value) => {
                                if (value) {
                                    setInstructionsView(value as InstructionsView);
                                }
                            }}
                            className="gap-0.5 rounded-md border bg-muted/40 p-0.5"
                        >
                            <ToggleGroupItem value="write" className="h-7 w-auto min-w-0 px-2.5 text-xs font-normal">
                                Write
                            </ToggleGroupItem>
                            <ToggleGroupItem value="split" className="h-7 w-auto min-w-0 px-2.5 text-xs font-normal">
                                Split
                            </ToggleGroupItem>
                            <ToggleGroupItem value="preview" className="h-7 w-auto min-w-0 px-2.5 text-xs font-normal">
                                Preview
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        markdown · {form.instructions.length.toLocaleString()} / {INSTRUCTIONS_MAX_LENGTH.toLocaleString()}
                    </span>
                </div>
                <div className={cn(
                    "mx-auto flex w-full min-h-0 flex-1 gap-4 px-6",
                    instructionsView === "split" ? "max-w-none" : "max-w-5xl",
                )}>
                    <div className={cn("h-full min-h-0 flex-1", instructionsView === "preview" && "hidden")}>
                        <div className="relative h-full">
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
                    {instructionsView !== "write" && (
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-muted/20 px-4 py-3">
                            {form.instructions.trim() ? (
                                <MarkdownRenderer
                                    content={form.instructions}
                                    escapeHtml
                                    className="prose-sm max-w-none"
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </form>
    );
}
