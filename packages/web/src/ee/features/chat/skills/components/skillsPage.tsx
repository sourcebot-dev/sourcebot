'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangleIcon,
    BookOpenIcon,
    Building2Icon,
    CheckCircle2Icon,
    CheckIcon,
    FolderGit2Icon,
    ListIcon,
    Loader2Icon,
    MoreHorizontalIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
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
    updatePersonalAgentSkillFromSource,
    updateSharedAgentSkill,
    updateSharedAgentSkillFromSource,
} from "@/ee/features/chat/skills/actions";
import { getSkillSourceStatus } from "@/app/api/(client)/client";
import { SkillInstructionsEditor } from "@/ee/features/chat/skills/components/skillInstructionsEditor";
import { ImportFromRepoDialog, type ImportedRepoSkill } from "@/ee/features/chat/skills/components/importFromRepoDialog";
import { useCreateSkillDraftMethod } from "@/ee/features/chat/skills/components/useCreateSkillDraftMethod";
import { MarkdownRenderer } from "@/ee/features/chat/components/chatThread/markdownRenderer";
import { TableOfContents } from "@/ee/features/chat/components/chatThread/tableOfContents";
import { useExtractTOCItems } from "@/ee/features/chat/useTOCItems";
import {
    AutoEnrolledSkillBadge,
    DeleteWorkspaceSkillDialog,
    SkillCommandBadge,
    SyncedSkillBadge,
} from "@/ee/features/chat/skills/components/workspaceSkillShared";
import {
    normalizeAgentSkillSlug,
    parseAgentSkillMarkdown,
    sortAgentSkillListItems,
    sortSharedAgentSkillCatalogItems,
    type AgentSkillInput,
    type AgentSkillListItem,
    type AgentSkillSourceRef,
    type AgentSkillSourceStatus,
    type ParsedAgentSkillMarkdown,
    type SharedAgentSkillCatalogItem,
} from "@/ee/features/chat/skills/types";
import { useUnsavedChangesGuard } from "@/ee/features/chat/useUnsavedChangesGuard";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { cn, isServiceError, unwrapServiceError } from "@/lib/utils";

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
    // The repository file this skill mirrors, or null. When set, the skill is a
    // read-only sync target: no inline editing, refreshed via "Update from source".
    source: AgentSkillSourceRef | null;
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
        source: skill.source,
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
        source: skill.source,
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
                className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-3 py-2.5 text-left"
            >
                <SkillAvatar name={name} size="sm" />
                <div className="min-w-0 flex-1 space-y-1">
                    <p className="max-w-full whitespace-normal break-words text-sm font-medium leading-5 text-foreground">
                        {name}
                    </p>
                    <div className="min-w-0">
                        <p className="min-w-0 break-all font-mono text-xs text-muted-foreground">/{slug}</p>
                        {badge && (
                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                                {badge}
                            </div>
                        )}
                    </div>
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
    const [form, setForm] = useState<AgentSkillInput>(emptySkillForm);
    const {
        createDraftMethod,
        markManualDraft,
        markLocalMarkdownDraft,
        resetDraftMethod,
    } = useCreateSkillDraftMethod();
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
            markManualDraft();
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
            markLocalMarkdownDraft();
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
        resetDraftMethod();
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
                const result = await createPersonalAgentSkill(form, {
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
                ? await updateSharedAgentSkill({ id: selectedSkill.id, ...form }, { entryPoint: 'skills_settings' })
                : await updatePersonalAgentSkill({ id: selectedSkill.id, ...form }, { entryPoint: 'skills_settings' });
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
                                    badge={skill.source ? <SyncedSkillBadge /> : undefined}
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
                                        skill.source || skill.autoEnrolled ? (
                                            <>
                                                {skill.source && <SyncedSkillBadge />}
                                                {skill.autoEnrolled && <AutoEnrolledSkillBadge />}
                                            </>
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
                            lockedSource={selectedSkill.source}
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
                open={confirmPublishSynced !== null}
                onOpenChange={(open) => {
                    if (!open && scopePendingId === null) {
                        setConfirmPublishSynced(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Share synced skill with your workspace?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-semibold text-foreground">{confirmPublishSynced?.name}</span>{" "}
                            is synced from{" "}
                            <span className="font-medium text-foreground">{confirmPublishSynced?.source?.repoName}</span>
                            . Sharing publishes the{" "}
                            <span className="font-mono text-foreground">/{confirmPublishSynced?.slug}</span>{" "}
                            command to your workspace and keeps it synced to the source file.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-muted-foreground">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
                        <p>
                            Organization owners who don&apos;t have access to{" "}
                            <span className="font-medium text-foreground">{confirmPublishSynced?.source?.repoName}</span>{" "}
                            will still be able to see and manage this skill from workspace settings. Members without access to the repository won&apos;t see it.
                        </p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={scopePendingId !== null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={scopePendingId !== null}
                            onClick={(event) => {
                                event.preventDefault();
                                if (confirmPublishSynced) {
                                    void handlePublish(confirmPublishSynced);
                                }
                            }}
                        >
                            {scopePendingId !== null ? "Sharing..." : "Share skill"}
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
    sourceUpdatePending: boolean;
    // When set, an owner can jump to the workspace admin table for shared skills.
    // Undefined for personal skills or non-owners.
    workspaceAdminHref?: string;
    onSharedToggle: (shared: boolean) => void;
    onEdit: () => void;
    onUpdateFromSource: () => void;
    onDelete: () => void;
}

function SkillDetailView({
    skill,
    scopePending,
    sourceUpdatePending,
    workspaceAdminHref,
    onSharedToggle,
    onEdit,
    onUpdateFromSource,
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
                        {/* Sharing a synced skill keeps it linked to its source: the
                            org-wide command stays synced and the author/owners refresh
                            it from source. Name + command stay editable either way. */}
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
                                {workspaceAdminHref && (
                                    <DropdownMenuItem asChild>
                                        <Link href={workspaceAdminHref}>
                                            <Building2Icon className="mr-2 h-4 w-4" />
                                            View in workspace settings
                                        </Link>
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

            {skill.source && (
                <SkillSourceSyncBanner
                    skill={skill}
                    source={skill.source}
                    canUpdate={canManage}
                    updatePending={sourceUpdatePending}
                    onUpdateFromSource={onUpdateFromSource}
                />
            )}

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

// Banner shown above a synced skill's content: provenance on the left, and — for
// users who can refresh it (a personal skill's owner, or a shared skill's author /
// org owner) — a live freshness check and the "Update from source" action when the
// indexed file has moved ahead of the imported version. Adopters who can't manage a
// shared skill see only the provenance.
function SkillSourceSyncBanner({
    skill,
    source,
    canUpdate,
    updatePending,
    onUpdateFromSource,
}: {
    skill: DetailSkill;
    source: AgentSkillSourceRef;
    canUpdate: boolean;
    updatePending: boolean;
    onUpdateFromSource: () => void;
}) {
    // Keyed on updatedAt so the check re-runs after an update bumps the skill. Only
    // runs for users who can act on it — there's no point surfacing staleness to an
    // adopter who can't refresh the org-wide command.
    const { data, isLoading, isError } = useQuery({
        queryKey: ["skillSourceStatus", skill.id, skill.updatedAt],
        queryFn: () => unwrapServiceError(getSkillSourceStatus(skill.id)),
        retry: false,
        enabled: canUpdate,
    });
    const status = data?.status;

    return (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-6 py-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <FolderGit2Icon className="h-4 w-4 shrink-0" />
                <span className="shrink-0">Synced from</span>
                <span className="truncate font-medium text-foreground">{source.repoName}</span>
                <span className="shrink-0 text-muted-foreground/60">·</span>
                <span className="truncate font-mono text-xs">{source.filePath}</span>
            </div>
            {canUpdate && (
                <div className="flex shrink-0 items-center gap-3">
                    <SkillSourceStatusIndicator status={status} isLoading={isLoading} isError={isError} />
                    {status === "update_available" && (
                        <Button size="sm" onClick={onUpdateFromSource} disabled={updatePending}>
                            {updatePending ? (
                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCwIcon className="mr-2 h-4 w-4" />
                            )}
                            {updatePending ? "Updating..." : "Update from source"}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

function SkillSourceStatusIndicator({
    status,
    isLoading,
    isError,
}: {
    status?: AgentSkillSourceStatus;
    isLoading: boolean;
    isError: boolean;
}) {
    if (isLoading) {
        return (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                Checking…
            </span>
        );
    }
    if (isError || status === "repo_unavailable" || status === "source_missing") {
        const label = status === "source_missing"
            ? "Source file not found"
            : status === "repo_unavailable"
                ? "Source repo unavailable"
                : "Couldn't check for updates";
        return (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                <AlertTriangleIcon className="h-3.5 w-3.5" />
                {label}
            </span>
        );
    }
    if (status === "update_available") {
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Update available
            </span>
        );
    }
    if (status === "in_sync") {
        return (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2Icon className="h-3.5 w-3.5 text-green-600" />
                Up to date
            </span>
        );
    }
    return null;
}

type InstructionsView = "write" | "split" | "preview";

interface SkillEditFormProps {
    mode: "create" | "edit";
    form: AgentSkillInput;
    isSaving: boolean;
    isDirty: boolean;
    // When set, the skill is synced from this repository file: its description and
    // instructions are read-only here (refreshed via "Update from source"); only the
    // name and command stay editable.
    lockedSource?: AgentSkillSourceRef | null;
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
    lockedSource = null,
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
    const contentLocked = lockedSource !== null;

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
                        <span className="ml-1 font-normal text-muted-foreground">
                            {contentLocked ? "(synced from source)" : "(optional)"}
                        </span>
                    </Label>
                    <Textarea
                        id="skill-description"
                        value={form.description}
                        onChange={(event) => onDescriptionChange(event.target.value)}
                        placeholder="Search for a symbol or API and summarize where it is defined, used, and tested."
                        className="min-h-16 resize-y disabled:cursor-not-allowed disabled:opacity-70"
                        maxLength={500}
                        disabled={contentLocked}
                    />
                </div>
            </div>

            {/* Instructions */}
            <div className="flex w-full min-h-0 flex-1 flex-col pb-6 pt-6">
                <div className="mx-auto mb-3 flex w-full max-w-5xl items-center justify-between gap-2 px-6">
                    <div className="flex items-center gap-3">
                        <Label htmlFor="skill-instructions" className="text-sm font-semibold">Instructions</Label>
                        {contentLocked ? (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <FolderGit2Icon className="h-3.5 w-3.5" />
                                Synced from {lockedSource?.repoName} · read-only
                            </span>
                        ) : (
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
                        )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                        markdown · {form.instructions.length.toLocaleString()} / {INSTRUCTIONS_MAX_LENGTH.toLocaleString()}
                    </span>
                </div>
                {contentLocked ? (
                    <div className="mx-auto flex w-full min-h-0 max-w-5xl flex-1 px-6">
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-muted/20 px-4 py-3">
                            {form.instructions.trim() ? (
                                <MarkdownRenderer
                                    content={form.instructions}
                                    escapeHtml
                                    className="prose-sm max-w-none"
                                />
                            ) : (
                                <p className="text-sm text-muted-foreground">No instructions.</p>
                            )}
                        </div>
                    </div>
                ) : (
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
                )}
            </div>
        </form>
    );
}
