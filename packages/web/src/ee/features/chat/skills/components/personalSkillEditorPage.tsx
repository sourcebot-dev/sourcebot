'use client';

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, Building2Icon, PanelRightCloseIcon, PanelRightOpenIcon, PencilIcon, PlusIcon, UploadIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { useToast } from "@/components/hooks/use-toast";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createSharedAgentSkill, createPersonalAgentSkill, updateSharedAgentSkill, updatePersonalAgentSkill } from "@/ee/features/chat/skills/actions";
import {
    SKILL_COMMAND_PLACEHOLDER,
    SKILL_DESCRIPTION_PLACEHOLDER,
    SKILL_INSTRUCTIONS_PLACEHOLDER,
    SKILL_NAME_PLACEHOLDER,
} from "@/ee/features/chat/skills/components/skillEditorCopy";
import { SkillInstructionsEditor } from "@/ee/features/chat/skills/components/skillInstructionsEditor";
import {
    emptySkillForm,
    INSTRUCTIONS_MAX_LENGTH,
} from "@/ee/features/chat/skills/components/skillsPageShared";
import { useCreateSkillDraftMethod } from "@/ee/features/chat/skills/components/useCreateSkillDraftMethod";
import { agentSkillInputSchema, normalizeAgentSkillSlug, parseAgentSkillMarkdown, type AgentSkillInput, type AgentSkillListItem } from "@/ee/features/chat/skills/types";
import { useUnsavedChangesGuard } from "@/ee/features/chat/useUnsavedChangesGuard";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { isServiceError } from "@/lib/utils";

const DETAILS_COLLAPSED_STORAGE_KEY = "sb.skillEditor.detailsCollapsed";

type SaveMode = "editShared" | "editPersonal" | "createShared" | "createPersonal";

const saveModeConfig = {
    editShared: {
        icon: PencilIcon,
        buttonLabel: "Save skill",
        successToast: "Shared skill updated.",
    },
    editPersonal: {
        icon: PencilIcon,
        buttonLabel: "Save skill",
        successToast: "Skill updated.",
    },
    createShared: {
        icon: Building2Icon,
        buttonLabel: "Create shared skill",
        successToast: "Shared skill created.",
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

export function SharedSkillEditorPage(props: { skill: AgentSkillListItem }) {
    return <SkillEditor {...props} />;
}

function SkillEditor({ skill }: PersonalSkillEditorPageProps) {
    const router = useRouter();
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();
    const markdownFileInputRef = useRef<HTMLInputElement>(null);
    const initialForm: AgentSkillInput = skill
        ? {
            name: skill.name,
            slug: skill.slug,
            description: skill.description,
            instructions: skill.instructions,
        }
        : emptySkillForm;
    const form = useForm<AgentSkillInput>({
        resolver: zodResolver(agentSkillInputSchema),
        defaultValues: initialForm,
    });
    const watchedName = useWatch({ control: form.control, name: "name" }) ?? "";
    const watchedSlug = useWatch({ control: form.control, name: "slug" }) ?? "";
    const [isSlugTouched, setIsSlugTouched] = useState(skill !== null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
    const [instructionsEditorKey, setInstructionsEditorKey] = useState(0);
    const [publishToShared, setPublishToShared] = useState(false);
    const { createDraftMethod, markLocalMarkdownDraft } = useCreateSkillDraftMethod();
    const isEditing = skill !== null;
    const isEditingSharedSkill = skill?.scope === "SHARED";
    const saveMode: SaveMode = isEditing
        ? isEditingSharedSkill ? "editShared" : "editPersonal"
        : publishToShared ? "createShared" : "createPersonal";
    const saveConfig = saveModeConfig[saveMode];
    const SaveIcon = saveConfig.icon;

    const isDirty = form.formState.isDirty || (!isEditing && publishToShared);

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

    const setFormValue = (name: keyof AgentSkillInput, value: string) => {
        form.setValue(name, value, {
            shouldDirty: true,
            shouldValidate: form.formState.isSubmitted,
        });
    };

    const handleNameChange = (name: string) => {
        setFormValue("name", name);
        if (!isSlugTouched) {
            setFormValue("slug", normalizeAgentSkillSlug(name));
        }
    };

    const handleMarkdownFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        input.value = "";

        if (!file) {
            return;
        }

        if (!/\.(md|markdown)$/i.test(file.name)) {
            captureEvent('ask_skill_import_completed', {
                source: 'sourcebot-web-client',
                entryPoint: 'account_ask_agent_settings',
                method: 'local_markdown',
                isSynced: false,
                success: false,
                failureReason: 'unsupported_file_type',
            });
            toast({ title: "Unsupported file", description: "Choose a markdown file ending in .md or .markdown.", variant: "destructive" });
            return;
        }

        try {
            const text = await file.text();
            const parsed = parseAgentSkillMarkdown(text, file.name);
            const current = form.getValues();
            captureEvent('ask_skill_import_completed', {
                source: 'sourcebot-web-client',
                entryPoint: 'account_ask_agent_settings',
                method: 'local_markdown',
                isSynced: false,
                hasFrontmatter: parsed.hasFrontmatter,
                hasDescription: Boolean(parsed.description),
                success: true,
            });
            setFormValue("name", parsed.name ?? current.name);
            setFormValue("slug", parsed.slug ?? current.slug);
            setFormValue("description", parsed.description ?? current.description);
            setFormValue("instructions", parsed.instructions);
            markLocalMarkdownDraft();
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
            captureEvent('ask_skill_import_completed', {
                source: 'sourcebot-web-client',
                entryPoint: 'account_ask_agent_settings',
                method: 'local_markdown',
                isSynced: false,
                success: false,
                failureReason: 'file_read_error',
            });
            toast({ title: "Error", description: "Failed to import markdown file.", variant: "destructive" });
        }
    };

    const handleSubmit = async (values: AgentSkillInput) => {
        setIsSaving(true);
        try {
            const result = await ({
                editShared: () => updateSharedAgentSkill({ id: skill!.id, ...values }, { entryPoint: 'account_ask_agent_settings' }),
                editPersonal: () => updatePersonalAgentSkill({ id: skill!.id, ...values }, { entryPoint: 'account_ask_agent_settings' }),
                createShared: () => createSharedAgentSkill(values, {
                    entryPoint: 'account_ask_agent_settings',
                    creationMethod: createDraftMethod,
                }),
                createPersonal: () => createPersonalAgentSkill(values, {
                    entryPoint: 'account_ask_agent_settings',
                    creationMethod: createDraftMethod,
                }),
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

    const handleInvalidSubmit = (errors: FieldErrors<AgentSkillInput>) => {
        if (errors.name || errors.slug || errors.description) {
            setDetailsCollapsed(false);
        }

        toast({
            title: "Fix validation errors",
            description: "Review the highlighted fields before saving.",
            variant: "destructive",
        });
    };

    const handleCancel = () => {
        router.push("/settings/accountAskAgent");
    };

    const triggerMarkdownImport = () => {
        markdownFileInputRef.current?.click();
    };

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)} className="flex h-full flex-col bg-background" noValidate>
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
                                    value={watchedName}
                                    onChange={(event) => handleNameChange(event.target.value)}
                                    placeholder={SKILL_NAME_PLACEHOLDER}
                                    size={Math.max(watchedName.length || SKILL_NAME_PLACEHOLDER.length, 4)}
                                    maxLength={80}
                                    aria-label="Skill name"
                                    aria-invalid={Boolean(form.formState.errors.name)}
                                    className="min-w-0 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground placeholder:font-normal"
                                />
                                {watchedSlug && (
                                    <span className="shrink-0 font-mono text-xs text-muted-foreground">/{watchedSlug}</span>
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
                        <FormField
                            control={form.control}
                            name="instructions"
                            render={({ field, fieldState }) => {
                                const instructionsErrorId = "agent-skill-instructions-error";
                                const instructionsDescriptionIds = fieldState.error
                                    ? instructionsErrorId
                                    : undefined;

                                return (
                                    <FormItem className="flex min-w-0 flex-1 flex-col space-y-0 px-6 py-4">
                                        <div className="mb-3 space-y-1">
                                            <div className="flex items-baseline gap-2">
                                                <Label htmlFor="agent-skill-instructions" className="text-sm font-semibold">
                                                    Instructions
                                                </Label>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {isDetailsCollapsed
                                                        ? "Focus mode - open details to edit name, command & description"
                                                        : "Markdown"}
                                                </span>
                                            </div>
                                            <FormMessage id={instructionsErrorId} className="text-xs" />
                                        </div>
                                        <div className="relative min-h-0 flex-1">
                                            <SkillInstructionsEditor
                                                key={instructionsEditorKey}
                                                id="agent-skill-instructions"
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder={SKILL_INSTRUCTIONS_PLACEHOLDER}
                                                ariaDescribedBy={instructionsDescriptionIds}
                                                ariaInvalid={Boolean(fieldState.error)}
                                                className="h-full resize-none pb-8 font-mono text-sm leading-relaxed"
                                            />
                                            <span className="pointer-events-none absolute bottom-3 right-4 text-xs text-muted-foreground">
                                                {field.value.length.toLocaleString()} / {INSTRUCTIONS_MAX_LENGTH.toLocaleString()}
                                            </span>
                                        </div>
                                    </FormItem>
                                );
                            }}
                        />

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
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Name</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        onChange={(event) => handleNameChange(event.target.value)}
                                                        placeholder={SKILL_NAME_PLACEHOLDER}
                                                        maxLength={80}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-xs" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="slug"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Command</FormLabel>
                                                <div className="relative">
                                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                                        /
                                                    </span>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            onChange={(event) => {
                                                                setIsSlugTouched(true);
                                                                field.onChange(event);
                                                            }}
                                                            onBlur={() => {
                                                                field.onBlur();
                                                                setFormValue("slug", normalizeAgentSkillSlug(form.getValues("slug")));
                                                            }}
                                                            placeholder={SKILL_COMMAND_PLACEHOLDER}
                                                            className="pl-7 font-mono"
                                                            maxLength={64}
                                                        />
                                                    </FormControl>
                                                </div>
                                                <FormMessage className="text-xs" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Description</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        {...field}
                                                        placeholder={SKILL_DESCRIPTION_PLACEHOLDER}
                                                        className="min-h-72 resize-y"
                                                        maxLength={500}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-xs" />
                                            </FormItem>
                                        )}
                                    />

                                    {!isEditing && (
                                        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
                                            <Label
                                                htmlFor="agent-skill-publish-to-shared"
                                                className="flex min-w-0 items-center gap-2 text-sm font-medium"
                                            >
                                                <Building2Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <span className="truncate">Create as shared skill</span>
                                            </Label>
                                            <Switch
                                                id="agent-skill-publish-to-shared"
                                                checked={publishToShared}
                                                disabled={isSaving}
                                                onCheckedChange={setPublishToShared}
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
                                        Front matter can fill name, command, and description on import.
                                    </p>
                                </div>
                            </aside>
                        )}
                    </div>
                </form>
            </Form>

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
