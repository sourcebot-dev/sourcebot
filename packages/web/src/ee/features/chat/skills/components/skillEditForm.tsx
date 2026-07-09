import { useEffect, useRef, useState, type FormEvent } from "react";
import {
    CheckIcon,
    FolderGit2Icon,
    Loader2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MarkdownRenderer } from "@/ee/features/chat/components/chatThread/markdownRenderer";
import {
    SKILL_COMMAND_HELP,
    SKILL_COMMAND_PLACEHOLDER,
    SKILL_DESCRIPTION_HELP,
    SKILL_DESCRIPTION_LOCKED_HELP,
    SKILL_DESCRIPTION_PLACEHOLDER,
    SKILL_INSTRUCTIONS_HELP,
    SKILL_INSTRUCTIONS_LOCKED_HELP,
    SKILL_INSTRUCTIONS_PLACEHOLDER,
    SKILL_NAME_HELP,
    SKILL_NAME_PLACEHOLDER,
} from "@/ee/features/chat/skills/components/skillEditorCopy";
import { SkillInstructionsEditor } from "@/ee/features/chat/skills/components/skillInstructionsEditor";
import {
    INSTRUCTIONS_MAX_LENGTH,
    SkillAvatar,
} from "@/ee/features/chat/skills/components/skillsPageShared";
import {
    type AgentSkillInput,
    type AgentSkillSourceRef,
} from "@/ee/features/chat/skills/types";
import { cn } from "@/lib/utils";

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

export function SkillEditForm({
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

            <div className="mx-auto grid w-full max-w-5xl shrink-0 grid-cols-1 gap-4 px-6 pt-6 sm:grid-cols-[3fr_2fr]">
                <div className="space-y-2">
                    <Label htmlFor="skill-name">Name</Label>
                    <Input
                        id="skill-name"
                        value={form.name}
                        onChange={(event) => onNameChange(event.target.value)}
                        placeholder={SKILL_NAME_PLACEHOLDER}
                        aria-describedby="skill-name-help"
                        maxLength={80}
                        required
                    />
                    <p id="skill-name-help" className="text-xs text-muted-foreground">
                        {SKILL_NAME_HELP}
                    </p>
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
                            placeholder={SKILL_COMMAND_PLACEHOLDER}
                            aria-describedby="skill-command-help"
                            className="pl-7 font-mono"
                            maxLength={64}
                            required
                        />
                    </div>
                    <p id="skill-command-help" className="text-xs text-muted-foreground">
                        {SKILL_COMMAND_HELP}
                    </p>
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
                        placeholder={SKILL_DESCRIPTION_PLACEHOLDER}
                        aria-describedby="skill-description-help"
                        className="min-h-16 resize-y disabled:cursor-not-allowed disabled:opacity-70"
                        maxLength={500}
                        disabled={contentLocked}
                    />
                    <p id="skill-description-help" className="text-xs text-muted-foreground">
                        {contentLocked ? SKILL_DESCRIPTION_LOCKED_HELP : SKILL_DESCRIPTION_HELP}
                    </p>
                </div>
            </div>

            <div className="flex w-full min-h-0 flex-1 flex-col pb-6 pt-6">
                <div className="mx-auto mb-3 flex w-full max-w-5xl flex-col gap-1 px-6">
                    <div className="flex items-center justify-between gap-2">
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
                    <p id="skill-instructions-help" className="text-xs text-muted-foreground">
                        {contentLocked ? SKILL_INSTRUCTIONS_LOCKED_HELP : SKILL_INSTRUCTIONS_HELP}
                    </p>
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
                                    placeholder={SKILL_INSTRUCTIONS_PLACEHOLDER}
                                    ariaDescribedBy="skill-instructions-help"
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
