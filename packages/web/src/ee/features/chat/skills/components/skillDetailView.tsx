import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangleIcon,
    BookOpenIcon,
    Building2Icon,
    CheckCircle2Icon,
    FolderGit2Icon,
    ListIcon,
    Loader2Icon,
    MoreHorizontalIcon,
    PencilIcon,
    RefreshCwIcon,
    Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { getSkillSourceStatus } from "@/app/api/(client)/client";
import { MarkdownRenderer } from "@/ee/features/chat/components/chatThread/markdownRenderer";
import { TableOfContents } from "@/ee/features/chat/components/chatThread/tableOfContents";
import { SkillCommandBadge } from "@/ee/features/chat/skills/components/workspaceSkillShared";
import {
    formatUpdatedAt,
    INSTRUCTIONS_MAX_LENGTH,
    SHARED_SKILL_SWITCH_CLASS_NAME,
    SkillAvatar,
    type DetailSkill,
} from "@/ee/features/chat/skills/components/skillsPageShared";
import { useExtractTOCItems } from "@/ee/features/chat/useTOCItems";
import {
    type AgentSkillSourceRef,
    type AgentSkillSourceStatus,
} from "@/ee/features/chat/skills/types";
import { unwrapServiceError } from "@/lib/utils";

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

export function SkillDetailView({
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
                                    className={SHARED_SKILL_SWITCH_CLASS_NAME}
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

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-6 py-3 @6xl:hidden">
                <SkillMetaChips skill={skill} />
            </div>

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

function DetailMetaField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="truncate text-sm text-foreground">{children}</p>
        </div>
    );
}

// Banner shown above a synced skill's content: provenance on the left, and, for
// users who can refresh it (a personal skill's owner, or a shared skill's author /
// org owner), a live freshness check and the "Update from source" action when the
// indexed file has moved ahead of the imported version. Adopters who can't manage
// a shared skill see only the provenance.
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
    // runs for users who can act on it; there's no point surfacing staleness to an
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
