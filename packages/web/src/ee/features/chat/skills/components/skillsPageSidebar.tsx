import { type ChangeEvent, type ReactNode, type RefObject } from "react";
import {
    FolderGit2Icon,
    PlusIcon,
    SearchIcon,
    UploadIcon,
} from "lucide-react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    AutoEnrolledSkillBadge,
    SyncedSkillBadge,
} from "@/ee/features/chat/skills/components/workspaceSkillShared";
import {
    type AgentSkillListItem,
    type SharedAgentSkillCatalogItem,
} from "@/ee/features/chat/skills/types";
import {
    SHARED_SKILL_SWITCH_CLASS_NAME,
    SkillAvatar,
} from "@/ee/features/chat/skills/components/skillsPageShared";
import { cn } from "@/lib/utils";

interface SkillsPageSidebarProps {
    filteredPersonal: AgentSkillListItem[];
    filteredShared: SharedAgentSkillCatalogItem[];
    searchQuery: string;
    selectedId: string | null;
    isCreatingNew: boolean;
    adoptionPendingId: string | null;
    markdownFileInputRef: RefObject<HTMLInputElement | null>;
    onSearchQueryChange: (searchQuery: string) => void;
    onImportMarkdownFile: (event: ChangeEvent<HTMLInputElement>) => void;
    onStartCreate: () => void;
    onTriggerMarkdownImport: () => void;
    onOpenRepoImport: () => void;
    onSelectSkill: (id: string) => void;
    onAdoptionChange: (skillId: string, adopt: boolean) => void;
}

export function SkillsPageSidebar({
    filteredPersonal,
    filteredShared,
    searchQuery,
    selectedId,
    isCreatingNew,
    adoptionPendingId,
    markdownFileInputRef,
    onSearchQueryChange,
    onImportMarkdownFile,
    onStartCreate,
    onTriggerMarkdownImport,
    onOpenRepoImport,
    onSelectSkill,
    onAdoptionChange,
}: SkillsPageSidebarProps) {
    const hasSearchQuery = Boolean(searchQuery.trim());

    return (
        <aside className="flex w-[320px] shrink-0 flex-col border-r">
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Skills</h2>
                <input
                    ref={markdownFileInputRef}
                    type="file"
                    accept=".md,.markdown,text/markdown,text/plain"
                    className="hidden"
                    onChange={onImportMarkdownFile}
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
                        <DropdownMenuItem onClick={onStartCreate}>
                            <PlusIcon className="mr-2 h-4 w-4" />
                            New skill
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onTriggerMarkdownImport}>
                            <UploadIcon className="mr-2 h-4 w-4" />
                            Import from file
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onOpenRepoImport}>
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
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        className="h-9 pl-9"
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
                <SkillListSection
                    label="Personal"
                    count={filteredPersonal.length}
                    emptyLabel={hasSearchQuery ? "No matches." : "No personal skills yet."}
                >
                    {filteredPersonal.map((skill) => (
                        <SkillListRow
                            key={skill.id}
                            name={skill.name}
                            slug={skill.slug}
                            isActive={selectedId === skill.id && !isCreatingNew}
                            onSelect={() => onSelectSkill(skill.id)}
                            badge={skill.source ? <SyncedSkillBadge /> : undefined}
                        />
                    ))}
                </SkillListSection>

                <SkillListSection
                    label="Shared"
                    count={filteredShared.length}
                    emptyLabel={hasSearchQuery ? "No matches." : "No shared skills yet."}
                >
                    {filteredShared.map((skill) => (
                        <SkillListRow
                            key={skill.id}
                            name={skill.name}
                            slug={skill.slug}
                            isActive={selectedId === skill.id && !isCreatingNew}
                            onSelect={() => onSelectSkill(skill.id)}
                            enabled={skill.isVisibleToUser}
                            togglePending={adoptionPendingId === skill.id}
                            onToggleEnabled={(checked) => onAdoptionChange(skill.id, checked)}
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
    children: ReactNode;
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

interface SkillListRowProps {
    name: string;
    slug: string;
    isActive: boolean;
    badge?: ReactNode;
    enabled?: boolean;
    togglePending?: boolean;
    onToggleEnabled?: (checked: boolean) => void;
    onSelect: () => void;
}

function SkillListRow({
    name,
    slug,
    isActive,
    badge,
    enabled,
    togglePending,
    onToggleEnabled,
    onSelect,
}: SkillListRowProps) {
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
                        SHARED_SKILL_SWITCH_CLASS_NAME,
                    )}
                />
            )}
        </div>
    );
}
