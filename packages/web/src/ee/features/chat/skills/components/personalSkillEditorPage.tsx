'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, Building2Icon, PanelRightCloseIcon, PanelRightOpenIcon, PencilIcon, PlusIcon, UploadIcon } from "lucide-react";
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
import { createOrgAgentSkill, createPersonalAgentSkill, updateOrgAgentSkill, updatePersonalAgentSkill } from "@/ee/features/chat/skills/actions";
import { SkillInstructionsEditor } from "@/ee/features/chat/skills/components/skillInstructionsEditor";
import { normalizeAgentSkillSlug, parseAgentSkillMarkdown, type AgentSkillInput, type AgentSkillListItem } from "@/ee/features/chat/skills/types";
import { useUnsavedChangesGuard } from "@/ee/features/chat/useUnsavedChangesGuard";
import { isServiceError } from "@/lib/utils";

const INSTRUCTIONS_MAX_LENGTH = 20000;
const DETAILS_COLLAPSED_STORAGE_KEY = "sb.skillEditor.detailsCollapsed";
const INSTRUCTIONS_PLACEHOLDER = `Find where $symbol is defined and used in $area.

<!-- Argument alternatives: use $0/$1 or $ARGUMENTS[0]/$ARGUMENTS[1] for positional args, or $ARGUMENTS for the full input. -->

Search for exact matches, related types, tests, and call sites. Prioritize the files most likely to explain the behavior.

Return:
- the most relevant files and symbols
- a short explanation of how the code is connected
- any follow-up searches that would narrow the answer`;

const emptySkillForm: AgentSkillInput = {
    name: "",
    slug: "",
    description: "",
    instructions: "",
    argumentNames: [],
    autoInvocationEnabled: false,
};

type SaveMode = "editWorkspace" | "editPersonal" | "createWorkspace" | "createPersonal";

const saveModeConfig = {
    editWorkspace: {
        icon: PencilIcon,
        buttonLabel: "Save skill",
        successToast: "Workspace skill updated.",
    },
    editPersonal: {
        icon: PencilIcon,
        buttonLabel: "Save skill",
        successToast: "Skill updated.",
    },
    createWorkspace: {
        icon: Building2Icon,
        buttonLabel: "Create workspace skill",
        successToast: "Workspace skill created.",
    },
    createPersonal: {
        icon: PlusIcon,
        buttonLabel: "Create skill",
        successToast: "Skill created.",
    },
} satisfies Record<SaveMode, {
    icon: typeof PencilIcon;
    buttonLabel: string;
    successToast: string;
}>;

interface PersonalSkillEditorPageProps {
    skill: AgentSkillListItem | null;
}

export function PersonalSkillEditorPage(props: PersonalSkillEditorPageProps) {
    return <SkillEditor {...props} />;
}

export function OrgSkillEditorPage(props: { skill: AgentSkillListItem }) {
    return <SkillEditor {...props} />;
}

function SkillEditor({ skill }: PersonalSkillEditorPageProps) {
    const router = useRouter();
    const { toast } = useToast();
    const markdownFileInputRef = useRef<HTMLInputElement>(null);
    const initialForm: AgentSkillInput = skill
        ? {
            name: skill.name,
            slug: skill.slug,
            description: skill.description,
            instructions: skill.instructions,
            argumentNames: skill.argumentNames,
            autoInvocationEnabled: skill.autoInvocationEnabled,
        }
        : emptySkillForm;
    const [form, setForm] = useState<AgentSkillInput>(initialForm);
    const [argumentNamesText, setArgumentNamesText] = useState(initialForm.argumentNames.join(" "));
    const [isSlugTouched, setIsSlugTouched] = useState(skill !== null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
    const [instructionsEditorKey, setInstructionsEditorKey] = useState(0);
    const [publishToWorkspace, setPublishToWorkspace] = useState(false);
    const isEditing = skill !== null;
    const isEditingWorkspaceSkill = skill?.scope === "ORG";
    const saveMode: SaveMode = isEditing
        ? isEditingWorkspaceSkill ? "editWorkspace" : "editPersonal"
        : publishToWorkspace ? "createWorkspace" : "createPersonal";
    const saveConfig = saveModeConfig[saveMode];
    const SaveIcon = saveConfig.icon;

    const isDirty =
        form.name !== initialForm.name ||
        form.slug !== initialForm.slug ||
        form.description !== initialForm.description ||
        form.instructions !== initialForm.instructions ||
        form.argumentNames.join("\0") !== initialForm.argumentNames.join("\0") ||
        form.autoInvocationEnabled !== initialForm.autoInvocationEnabled ||
        (!isEditing && publishToWorkspace);

    // Intercept in-app navigation (the Cancel button, the Back link, settings
    // sidebar links, and the browser back button) while there are unsaved
    // changes, and resolve it through the themed dialog below.
    const navGuard = useUnsavedChangesGuard({ enabled: isDirty });

    // Restore the panel preference after mount to avoid an SSR hydration mismatch.
    // Creating a skill always starts with details expanded so name/command are
    // front-and-center; editing restores the user's last preference.
    useEffect(() => {
        if (isEditing && window.localStorage.getItem(DETAILS_COLLAPSED_STORAGE_KEY) === "true") {
            setIsDetailsCollapsed(true);
        }
    }, [isEditing]);

    const setDetailsCollapsed = (collapsed: boolean) => {
        setIsDetailsCollapsed(collapsed);
        window.localStorage.setItem(DETAILS_COLLAPSED_STORAGE_KEY, String(collapsed));
    };

    const handleNameChange = (name: string) => {
        setForm((current) => ({
            ...current,
            name,
            slug: isSlugTouched ? current.slug : normalizeAgentSkillSlug(name),
        }));
    };

    const handleMarkdownFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
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

        try {
            const text = await file.text();
            const parsed = parseAgentSkillMarkdown(text, file.name);
            const importedArgumentNames = parsed.argumentNames ?? [];
            setForm((current) => ({
                name: parsed.name ?? current.name,
                slug: parsed.slug ?? current.slug,
                description: parsed.description ?? current.description,
                instructions: parsed.instructions,
                argumentNames: importedArgumentNames,
                autoInvocationEnabled: current.autoInvocationEnabled,
            }));
            setArgumentNamesText(importedArgumentNames.join(" "));
            setInstructionsEditorKey((key) => key + 1);

            if (parsed.slug || parsed.name) {
                setIsSlugTouched(true);
            }

            toast({
                title: parsed.frontmatterError ? "Front matter issue" : undefined,
                description: parsed.frontmatterError
                    ? `Markdown skill imported. ${parsed.frontmatterError}`
                    : "Markdown skill imported.",
                variant: parsed.frontmatterError ? "destructive" : undefined,
            });
        } catch {
            toast({ title: "Error", description: "Failed to import markdown file.", variant: "destructive" });
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSaving(true);
        try {
            const result = await ({
                editWorkspace: () => updateOrgAgentSkill({ id: skill!.id, ...form }),
                editPersonal: () => updatePersonalAgentSkill({ id: skill!.id, ...form }),
                createWorkspace: () => createOrgAgentSkill(form),
                createPersonal: () => createPersonalAgentSkill(form),
            } satisfies Record<SaveMode, () => ReturnType<typeof createPersonalAgentSkill>>)[saveMode]();

            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }

            toast({
                description: saveConfig.successToast,
            });
            // The form is still "dirty" versus its initial values at this point,
            // so suppress the guard for the post-save redirect.
            navGuard.bypass();
            router.push("/settings/accountAskAgent");
        } catch {
            toast({ title: "Error", description: "Failed to save skill.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        router.push("/settings/accountAskAgent");
    };

    const triggerMarkdownImport = () => {
        markdownFileInputRef.current?.click();
    };

    const handleArgumentNamesChange = (value: string) => {
        setArgumentNamesText(value);
        setForm((current) => ({
            ...current,
            argumentNames: value.trim().length === 0 ? [] : value.trim().split(/\s+/),
        }));
    };

    return (
        <>
        <form onSubmit={handleSubmit} className="flex h-full flex-col bg-background">
            <input
                ref={markdownFileInputRef}
                type="file"
                accept=".md,.markdown,text/markdown,text/plain"
                className="hidden"
                onChange={handleMarkdownFileChange}
            />

            {/* Top bar */}
            <header className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-3">
                <div className="flex min-w-0 items-center gap-3">
                    <Link
                        href="/settings/accountAskAgent"
                        className="inline-flex shrink-0 items-center gap-1.5 text-sm text-link hover:underline"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to Ask Sourcebot
                    </Link>
                    <span className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1 transition-colors focus-within:border-ring focus-within:bg-muted/60">
                        <input
                            value={form.name}
                            onChange={(event) => handleNameChange(event.target.value)}
                            placeholder={isEditing ? "Untitled skill" : "New skill"}
                            size={Math.max(form.name.length || (isEditing ? "Untitled skill".length : "New skill".length), 4)}
                            maxLength={80}
                            aria-label="Skill name"
                            className="min-w-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
                        />
                        {form.slug && (
                            <span className="shrink-0 font-mono text-xs text-muted-foreground">/{form.slug}</span>
                        )}
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button type="button" variant="outline" disabled={isSaving} onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                        <SaveIcon className="h-4 w-4 mr-2" />
                        {isSaving ? "Saving..." : saveConfig.buttonLabel}
                    </Button>
                </div>
            </header>

            {/* Body: instructions canvas + details panel */}
            <div className="flex min-h-0 flex-1">
                {/* Instructions canvas */}
                <div className="flex min-w-0 flex-1 flex-col px-6 py-4">
                    <div className="mb-3 flex items-baseline gap-2">
                        <Label htmlFor="agent-skill-instructions" className="text-sm font-semibold">
                            Instructions
                        </Label>
                        <span className="truncate text-xs text-muted-foreground">
                            {isDetailsCollapsed
                                ? "Focus mode — open details to edit name, command & description"
                                : "Markdown"}
                        </span>
                    </div>
                    <div className="relative min-h-0 flex-1">
                        <SkillInstructionsEditor
                            key={instructionsEditorKey}
                            id="agent-skill-instructions"
                            value={form.instructions}
                            onChange={(instructions) => setForm((current) => ({ ...current, instructions }))}
                            placeholder={INSTRUCTIONS_PLACEHOLDER}
                            className="h-full resize-none pb-8 font-mono text-sm leading-relaxed"
                        />
                        <span className="pointer-events-none absolute bottom-3 right-4 text-xs text-muted-foreground">
                            {form.instructions.length.toLocaleString()} / {INSTRUCTIONS_MAX_LENGTH.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Details panel / collapsed rail */}
                {isDetailsCollapsed ? (
                    <aside className="flex w-12 shrink-0 flex-col items-center gap-3 border-l py-4">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            aria-label="Open skill details"
                            onClick={() => setDetailsCollapsed(false)}
                        >
                            <PanelRightOpenIcon className="h-4 w-4" />
                        </Button>
                        <button
                            type="button"
                            onClick={() => setDetailsCollapsed(false)}
                            className="text-xs font-medium tracking-wide text-muted-foreground transition-colors hover:text-foreground [writing-mode:vertical-rl]"
                        >
                            Details
                        </button>
                    </aside>
                ) : (
                    <aside className="flex w-[360px] shrink-0 flex-col border-l">
                        <div className="flex shrink-0 items-center justify-between px-5 py-4">
                            <h4 className="text-sm font-semibold text-foreground">Skill details</h4>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                aria-label="Collapse skill details"
                                onClick={() => setDetailsCollapsed(true)}
                            >
                                <PanelRightCloseIcon className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
                            <div className="space-y-2">
                                <Label htmlFor="agent-skill-name">Name</Label>
                                <Input
                                    id="agent-skill-name"
                                    value={form.name}
                                    onChange={(event) => handleNameChange(event.target.value)}
                                    placeholder="Find references"
                                    maxLength={80}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="agent-skill-command">Command</Label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                        /
                                    </span>
                                    <Input
                                        id="agent-skill-command"
                                        value={form.slug}
                                        onChange={(event) => {
                                            const { value } = event.target;
                                            setIsSlugTouched(true);
                                            setForm((current) => ({
                                                ...current,
                                                slug: value,
                                            }));
                                        }}
                                        onBlur={() => {
                                            setForm((current) => ({
                                                ...current,
                                                slug: normalizeAgentSkillSlug(current.slug),
                                            }));
                                        }}
                                        placeholder="find-refs"
                                        className="pl-7 font-mono"
                                        maxLength={64}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="agent-skill-description">
                                    Description
                                    <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
                                </Label>
                                <Textarea
                                    id="agent-skill-description"
                                    value={form.description}
                                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                    placeholder="Search for a symbol or API and summarize where it is defined, used, and tested."
                                    className="min-h-72 resize-y"
                                    maxLength={500}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="agent-skill-arguments">
                                    Arguments
                                    <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
                                </Label>
                                <Input
                                    id="agent-skill-arguments"
                                    value={argumentNamesText}
                                    onChange={(event) => handleArgumentNamesChange(event.target.value)}
                                    placeholder="symbol area"
                                    className="font-mono"
                                />
                            </div>

                            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
                                <Label
                                    htmlFor="agent-skill-auto-invocation"
                                    className="flex min-w-0 flex-col gap-0.5 text-sm font-medium"
                                >
                                    <span className="truncate">Let the assistant auto-invoke this skill</span>
                                    <span className="text-xs font-normal text-muted-foreground">
                                        When on, Ask can apply this skill on its own based on its description.
                                    </span>
                                </Label>
                                <Switch
                                    id="agent-skill-auto-invocation"
                                    checked={form.autoInvocationEnabled}
                                    disabled={isSaving}
                                    onCheckedChange={(checked) => setForm((current) => ({ ...current, autoInvocationEnabled: checked }))}
                                />
                            </div>

                            {!isEditing && (
                                <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
                                    <Label
                                        htmlFor="agent-skill-publish-to-workspace"
                                        className="flex min-w-0 items-center gap-2 text-sm font-medium"
                                    >
                                        <Building2Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate">Create as workspace skill</span>
                                    </Label>
                                    <Switch
                                        id="agent-skill-publish-to-workspace"
                                        checked={publishToWorkspace}
                                        disabled={isSaving}
                                        onCheckedChange={setPublishToWorkspace}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 space-y-2 border-t px-5 py-4">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                disabled={isSaving}
                                onClick={triggerMarkdownImport}
                            >
                                <UploadIcon className="h-4 w-4 mr-2" />
                                Import markdown
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Front matter can fill name, command, arguments, and description on import.
                            </p>
                        </div>
                    </aside>
                )}
            </div>
        </form>

        <AlertDialog
            open={navGuard.active}
            onOpenChange={(open) => {
                if (!open) {
                    navGuard.resolve(false);
                }
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes to this skill. If you leave now, your progress will be lost.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => navGuard.resolve(false)}>
                        Keep editing
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => navGuard.resolve(true)}
                    >
                        Discard changes
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
