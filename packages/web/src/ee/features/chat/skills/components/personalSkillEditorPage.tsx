'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavigationGuardProvider, useNavigationGuard } from "next-navigation-guard";
import { ArrowLeftIcon, PanelRightCloseIcon, PanelRightOpenIcon, PencilIcon, PlusIcon, UploadIcon } from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPersonalAgentSkill, updatePersonalAgentSkill } from "@/ee/features/chat/skills/actions";
import { normalizeAgentSkillSlug, parseAgentSkillMarkdown, type AgentSkillInput, type AgentSkillListItem } from "@/ee/features/chat/skills/types";
import { isServiceError } from "@/lib/utils";

const INSTRUCTIONS_MAX_LENGTH = 20000;
const DETAILS_COLLAPSED_STORAGE_KEY = "sb.skillEditor.detailsCollapsed";

const emptySkillForm: AgentSkillInput = {
    name: "",
    slug: "",
    description: "",
    instructions: "",
};

interface PersonalSkillEditorPageProps {
    skill: AgentSkillListItem | null;
}

// The NavigationGuardProvider must be an ancestor of the component that calls
// useNavigationGuard, so it patches the router / intercepts the in-editor links
// (Cancel, Back) used by SkillEditor.
export function PersonalSkillEditorPage(props: PersonalSkillEditorPageProps) {
    return (
        <NavigationGuardProvider>
            <SkillEditor {...props} />
        </NavigationGuardProvider>
    );
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
        }
        : emptySkillForm;
    const [form, setForm] = useState<AgentSkillInput>(initialForm);
    const [isSlugTouched, setIsSlugTouched] = useState(skill !== null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
    const isEditing = skill !== null;

    const isDirty =
        form.name !== initialForm.name ||
        form.slug !== initialForm.slug ||
        form.description !== initialForm.description ||
        form.instructions !== initialForm.instructions;

    // Set just before a deliberate save-then-navigate so the discard guard does
    // not prompt on the post-save redirect (the form is still "dirty" vs. its
    // initial values at that point).
    const bypassGuardRef = useRef(false);

    // Intercept in-app navigation (the Cancel button, the Back link, and the
    // browser back button) while there are unsaved changes, and resolve it
    // through a themed dialog. `beforeunload` (refresh / tab close) is left to
    // the native handler below since browsers won't render custom dialogs there.
    // The settings sidebar lives in a separate parallel-route slot outside this
    // provider, so navigating away via a sidebar link is not currently guarded.
    const navGuard = useNavigationGuard({
        enabled: ({ type }) => {
            if (bypassGuardRef.current) {
                return false;
            }
            if (type === "beforeunload") {
                return false;
            }
            return isDirty;
        },
    });

    // Each time the guard re-activates, reset the one-shot decision latch that
    // keeps accept()/reject() from both firing (the action buttons close the
    // dialog, which would otherwise also trigger the onOpenChange path).
    const guardDecisionMadeRef = useRef(false);
    useEffect(() => {
        if (navGuard.active) {
            guardDecisionMadeRef.current = false;
        }
    }, [navGuard.active]);

    const resolveNavGuard = (discard: boolean) => {
        if (guardDecisionMadeRef.current) {
            return;
        }
        guardDecisionMadeRef.current = true;
        if (discard) {
            navGuard.accept();
        } else {
            navGuard.reject();
        }
    };

    // Warn before a full-page unload (refresh, tab close, external navigation)
    // when there are unsaved changes. The themed guard above covers in-app
    // navigation; this native prompt is the unavoidable browser fallback.
    useEffect(() => {
        if (!isDirty) {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

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
            setForm((current) => ({
                name: parsed.name ?? current.name,
                slug: parsed.slug ?? current.slug,
                description: parsed.description ?? current.description,
                instructions: parsed.instructions,
            }));

            if (parsed.slug || parsed.name) {
                setIsSlugTouched(true);
            }

            toast({
                title: parsed.frontmatterError ? "Front matter not parsed" : undefined,
                description: parsed.frontmatterError
                    ? "The markdown body was imported, but front matter could not be parsed."
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
            const result = isEditing
                ? await updatePersonalAgentSkill({ id: skill.id, ...form })
                : await createPersonalAgentSkill(form);

            if (isServiceError(result)) {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                return;
            }

            toast({ description: isEditing ? "Skill updated." : "Skill created." });
            bypassGuardRef.current = true;
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
                        {isEditing ? <PencilIcon className="h-4 w-4 mr-2" /> : <PlusIcon className="h-4 w-4 mr-2" />}
                        {isSaving ? "Saving..." : isEditing ? "Save skill" : "Create skill"}
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
                        <Textarea
                            id="agent-skill-instructions"
                            value={form.instructions}
                            onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))}
                            placeholder="Focus on bugs, regressions, security issues, and test gaps. Prioritize findings by severity."
                            className="h-full resize-none pb-8 font-mono text-sm leading-relaxed"
                            maxLength={INSTRUCTIONS_MAX_LENGTH}
                            required
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
                                    placeholder="PR review"
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
                                        placeholder="pr-review"
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
                                    placeholder="Review a pull request for correctness, risky changes, and missing tests."
                                    className="min-h-72 resize-y"
                                    maxLength={500}
                                />
                            </div>
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

        <AlertDialog
            open={navGuard.active}
            onOpenChange={(open) => {
                if (!open) {
                    resolveNavGuard(false);
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
                    <AlertDialogCancel onClick={() => resolveNavGuard(false)}>
                        Keep editing
                    </AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => resolveNavGuard(true)}
                    >
                        Discard changes
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
