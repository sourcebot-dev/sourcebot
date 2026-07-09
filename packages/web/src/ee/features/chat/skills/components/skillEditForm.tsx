import { useEffect, useRef, useState } from "react";
import {
    CheckIcon,
    FolderGit2Icon,
    Loader2Icon,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MarkdownRenderer } from "@/ee/features/chat/components/chatThread/markdownRenderer";
import {
    SKILL_COMMAND_HELP,
    SKILL_COMMAND_PLACEHOLDER,
    SKILL_DESCRIPTION_HELP,
    SKILL_DESCRIPTION_PLACEHOLDER,
    SKILL_INSTRUCTIONS_HELP,
    SKILL_INSTRUCTIONS_PLACEHOLDER,
    SKILL_INSTRUCTIONS_SYNCED_HELP,
    SKILL_NAME_HELP,
    SKILL_NAME_PLACEHOLDER,
} from "@/ee/features/chat/skills/components/skillEditorCopy";
import { SkillInstructionsEditor } from "@/ee/features/chat/skills/components/skillInstructionsEditor";
import {
    INSTRUCTIONS_MAX_LENGTH,
    SkillAvatar,
} from "@/ee/features/chat/skills/components/skillsPageShared";
import {
    agentSkillInputSchema,
    normalizeAgentSkillSlug,
    type AgentSkillInput,
    type AgentSkillSourceRef,
} from "@/ee/features/chat/skills/types";
import { cn } from "@/lib/utils";

type InstructionsView = "write" | "split" | "preview";

interface SkillEditFormProps {
    mode: "create" | "edit";
    initialForm: AgentSkillInput;
    isSaving: boolean;
    // When set, the skill is (or will be, in create mode) synced from this
    // repository file. All fields stay editable; local edits persist until the
    // skill is updated from its source, which replaces them.
    syncedSource?: AgentSkillSourceRef | null;
    initialSlugTouched?: boolean;
    onDirtyChange: (isDirty: boolean) => void;
    onSubmit: (form: AgentSkillInput) => void | Promise<void>;
    onInvalidSubmit: () => void;
    onCancel: () => void;
    editorKey: string;
}

export function SkillEditForm({
    mode,
    initialForm,
    isSaving,
    syncedSource = null,
    initialSlugTouched = false,
    onDirtyChange,
    onSubmit,
    onInvalidSubmit,
    onCancel,
    editorKey,
}: SkillEditFormProps) {
    const [instructionsView, setInstructionsView] = useState<InstructionsView>("write");
    const [isSlugTouched, setIsSlugTouched] = useState(initialSlugTouched);
    const formRef = useRef<HTMLFormElement>(null);
    const skillForm = useForm<AgentSkillInput>({
        resolver: zodResolver(agentSkillInputSchema),
        defaultValues: initialForm,
    });
    const {
        control,
        formState,
        getValues,
        handleSubmit,
        reset,
        setValue,
    } = skillForm;
    const name = useWatch({ control, name: "name" }) ?? "";
    const instructions = useWatch({ control, name: "instructions" }) ?? "";
    const instructionsError = formState.errors.instructions;
    const instructionsHelpId = "skill-instructions-help";
    const instructionsErrorId = "skill-instructions-error";
    const instructionsDescriptionIds = instructionsError
        ? `${instructionsHelpId} ${instructionsErrorId}`
        : instructionsHelpId;

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

    useEffect(() => {
        reset(initialForm);
        setIsSlugTouched(initialSlugTouched);
        onDirtyChange(false);
    }, [editorKey, initialForm, initialSlugTouched, onDirtyChange, reset]);

    useEffect(() => {
        onDirtyChange(formState.isDirty);
    }, [formState.isDirty, onDirtyChange]);

    const handleNameChange = (value: string) => {
        setValue("name", value, {
            shouldDirty: true,
            shouldValidate: formState.isSubmitted,
        });
        if (!isSlugTouched) {
            setValue("slug", normalizeAgentSkillSlug(value), {
                shouldDirty: true,
                shouldValidate: formState.isSubmitted,
            });
        }
    };

    const handleSlugChange = (value: string) => {
        setIsSlugTouched(true);
        setValue("slug", value, {
            shouldDirty: true,
            shouldValidate: formState.isSubmitted,
        });
    };

    const handleSlugBlur = () => {
        setValue("slug", normalizeAgentSkillSlug(getValues("slug")), {
            shouldDirty: true,
            shouldValidate: formState.isSubmitted,
        });
    };

    const handleDescriptionChange = (value: string) => {
        setValue("description", value, {
            shouldDirty: true,
            shouldValidate: formState.isSubmitted,
        });
    };

    const handleInstructionsChange = (value: string) => {
        setValue("instructions", value, {
            shouldDirty: true,
            shouldValidate: formState.isSubmitted,
        });
    };

    return (
        <Form {...skillForm}>
        <form ref={formRef} onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="flex h-full min-h-0 flex-col" noValidate>
            <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 pb-5 pt-6">
                <div className="flex min-w-0 items-center gap-3">
                    <SkillAvatar name={name || "?"} />
                    <h3 className="truncate text-xl font-semibold tracking-tight text-foreground">
                        {mode === "create" ? "New skill" : "Edit skill"}
                    </h3>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    {formState.isDirty && !isSaving && (
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

            <div className="mx-auto grid w-full max-w-5xl shrink-0 grid-cols-1 gap-4 px-6 pt-6 sm:grid-cols-[3fr_2fr]">
                <FormField
                    control={control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    onChange={(event) => {
                                        handleNameChange(event.target.value);
                                    }}
                                    placeholder={SKILL_NAME_PLACEHOLDER}
                                    maxLength={80}
                                />
                            </FormControl>
                            <FormDescription className="text-xs">
                                {SKILL_NAME_HELP}
                            </FormDescription>
                            <FormMessage className="text-xs" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="slug"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Command</FormLabel>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">/</span>
                                <FormControl>
                                    <Input
                                        {...field}
                                        onChange={(event) => {
                                            handleSlugChange(event.target.value);
                                        }}
                                        onBlur={() => {
                                            field.onBlur();
                                            handleSlugBlur();
                                        }}
                                        placeholder={SKILL_COMMAND_PLACEHOLDER}
                                        className="pl-7 font-mono"
                                        maxLength={64}
                                    />
                                </FormControl>
                            </div>
                            <FormDescription className="text-xs">
                                {SKILL_COMMAND_HELP}
                            </FormDescription>
                            <FormMessage className="text-xs" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="description"
                    render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea
                                    {...field}
                                    onChange={(event) => {
                                        handleDescriptionChange(event.target.value);
                                    }}
                                    placeholder={SKILL_DESCRIPTION_PLACEHOLDER}
                                    className="min-h-16 resize-y"
                                    maxLength={500}
                                />
                            </FormControl>
                            <FormDescription className="text-xs">
                                {SKILL_DESCRIPTION_HELP}
                            </FormDescription>
                            <FormMessage className="text-xs" />
                        </FormItem>
                    )}
                />
            </div>

            <div className="flex w-full min-h-0 flex-1 flex-col pb-6 pt-6">
                <div className="mx-auto mb-3 flex w-full max-w-5xl flex-col gap-1 px-6">
                    <div className="flex items-center justify-between gap-2">
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
                            {syncedSource && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <FolderGit2Icon className="h-3.5 w-3.5" />
                                    Synced from {syncedSource.repoName}
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                            markdown · {(instructions ?? "").length.toLocaleString()} / {INSTRUCTIONS_MAX_LENGTH.toLocaleString()}
                        </span>
                    </div>
                    <p id={instructionsHelpId} className="text-xs text-muted-foreground">
                        {syncedSource ? SKILL_INSTRUCTIONS_SYNCED_HELP : SKILL_INSTRUCTIONS_HELP}
                    </p>
                    {instructionsError?.message && (
                        <p id={instructionsErrorId} className="text-xs font-medium text-destructive">
                            {instructionsError.message}
                        </p>
                    )}
                </div>
                <div className={cn(
                    "mx-auto flex w-full min-h-0 flex-1 gap-4 px-6",
                    instructionsView === "split" ? "max-w-none" : "max-w-5xl",
                )}>
                    <div className={cn("h-full min-h-0 flex-1", instructionsView === "preview" && "hidden")}>
                        <div className="relative h-full">
                            <FormField
                                control={control}
                                name="instructions"
                                render={({ field }) => (
                                    <SkillInstructionsEditor
                                        key={editorKey}
                                        id="skill-instructions"
                                        value={field.value}
                                        onChange={(instructions) => {
                                            handleInstructionsChange(instructions);
                                        }}
                                        placeholder={SKILL_INSTRUCTIONS_PLACEHOLDER}
                                        ariaDescribedBy={instructionsDescriptionIds}
                                        ariaInvalid={Boolean(instructionsError)}
                                        className="h-full resize-none font-mono text-sm leading-relaxed"
                                    />
                                )}
                            />
                        </div>
                    </div>
                    {instructionsView !== "write" && (
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-muted/20 px-4 py-3">
                            {instructions.trim() ? (
                                <MarkdownRenderer
                                    content={instructions}
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
        </Form>
    );
}
