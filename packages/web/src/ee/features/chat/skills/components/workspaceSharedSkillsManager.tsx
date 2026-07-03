'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { InfoIcon, Loader2, SearchIcon, Trash2Icon } from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    deleteWorkspaceSkill,
    updateWorkspaceSkillFlag,
    type OrgSkillFlagKey,
} from "@/ee/features/chat/skills/components/workspaceSkillMutations";
import {
    AUTO_ENROLLED_SKILL_TOOLTIP,
    DeleteWorkspaceSkillDialog,
    SyncedSkillBadge,
    WorkspaceSkillsEmptyState,
} from "@/ee/features/chat/skills/components/workspaceSkillShared";
import { sortSharedAgentSkillManagementItems, type SharedAgentSkillManagementItem } from "@/ee/features/chat/skills/types";
import { pluralize } from "@/features/chat/mcp/utils";
import { cn } from "@/lib/utils";

// Synced = mirrors a repository file (has a source); Manual = created in-app or
// imported from a local file (no source).
type SkillSourceFilter = "all" | "synced" | "manual";

export function WorkspaceSharedSkillsManager({
    initialOrgSkills,
}: {
    initialOrgSkills: SharedAgentSkillManagementItem[];
}) {
    const { toast } = useToast();
    const [orgSkills, setOrgSkills] = useState(() => sortSharedAgentSkillManagementItems(initialOrgSkills));
    const [search, setSearch] = useState("");
    const [sourceFilter, setSourceFilter] = useState<SkillSourceFilter>("all");
    const [flagPendingSkills, setFlagPendingSkills] = useState<Record<string, OrgSkillFlagKey>>({});
    const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);
    const [skillToDelete, setSkillToDelete] = useState<SharedAgentSkillManagementItem | null>(null);

    const handleFlagChange = async (
        skill: SharedAgentSkillManagementItem,
        flag: OrgSkillFlagKey,
        checked: boolean,
    ) => {
        if (flagPendingSkills[skill.id] !== undefined) {
            return;
        }

        setFlagPendingSkills((current) => ({ ...current, [skill.id]: flag }));
        try {
            const error = await updateWorkspaceSkillFlag({
                skillId: skill.id,
                flag,
                checked,
                updateOrgSkills: setOrgSkills,
            });
            if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
                return;
            }

            toast({ description: "Shared skill updated." });
        } catch {
            toast({ title: "Error", description: "Failed to update shared skill.", variant: "destructive" });
        } finally {
            setFlagPendingSkills((current) => {
                const next = { ...current };
                delete next[skill.id];
                return next;
            });
        }
    };

    const handleDelete = async (skillId: string) => {
        if (flagPendingSkills[skillId] !== undefined) {
            return;
        }

        setDeletingSkillId(skillId);
        try {
            const error = await deleteWorkspaceSkill({ skillId, updateOrgSkills: setOrgSkills });
            if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
                return;
            }

            setSkillToDelete(null);
            toast({ description: "Shared skill deleted." });
        } catch {
            toast({ title: "Error", description: "Failed to delete shared skill.", variant: "destructive" });
        } finally {
            setDeletingSkillId(null);
        }
    };

    const filteredSkills = useMemo(() => {
        const query = search.trim().toLowerCase();
        return orgSkills.filter((skill) => {
            if (sourceFilter === "synced" && !skill.source) {
                return false;
            }
            if (sourceFilter === "manual" && skill.source) {
                return false;
            }
            if (query && !(skill.name.toLowerCase().includes(query) || skill.slug.toLowerCase().includes(query))) {
                return false;
            }
            return true;
        });
    }, [orgSkills, search, sourceFilter]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h4 className="text-sm font-semibold text-foreground">Shared skills</h4>
                    <p className="text-sm text-muted-foreground">Available to everyone in your workspace.</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                    {orgSkills.length} {pluralize(orgSkills.length, "skill")}
                </p>
            </div>

            {orgSkills.length === 0 ? (
                <WorkspaceSkillsEmptyState />
            ) : (
                <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search skills or commands..."
                                className="h-9 pl-9"
                                aria-label="Search skills or commands"
                            />
                        </div>
                        <ToggleGroup
                            type="single"
                            value={sourceFilter}
                            onValueChange={(value) => {
                                if (value) {
                                    setSourceFilter(value as SkillSourceFilter);
                                }
                            }}
                            className="shrink-0 gap-0.5 rounded-md border bg-muted/40 p-0.5"
                        >
                            <ToggleGroupItem value="all" className="h-7 w-auto min-w-0 px-3 text-xs font-normal">All</ToggleGroupItem>
                            <ToggleGroupItem value="synced" className="h-7 w-auto min-w-0 px-3 text-xs font-normal">Synced</ToggleGroupItem>
                            <ToggleGroupItem value="manual" className="h-7 w-auto min-w-0 px-3 text-xs font-normal">Manual</ToggleGroupItem>
                        </ToggleGroup>
                    </div>

                    <Table wrapperClassName="max-h-[22rem] overflow-y-auto rounded-lg border">
                        <TableHeader className="sticky top-0 z-10 bg-card">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="h-10 w-1/2 px-4 text-xs uppercase tracking-wider">Skill</TableHead>
                                <TableHead className="h-10 w-1/2 px-4 text-xs uppercase tracking-wider">Added by</TableHead>
                                <TableHead className="h-10 w-24 whitespace-nowrap px-4 text-xs uppercase tracking-wider">
                                    <span className="inline-flex items-center gap-1">
                                        Auto
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span tabIndex={0} className="inline-flex cursor-help text-muted-foreground">
                                                    <InfoIcon className="h-3.5 w-3.5" />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent>{AUTO_ENROLLED_SKILL_TOOLTIP}</TooltipContent>
                                        </Tooltip>
                                    </span>
                                </TableHead>
                                <TableHead className="h-10 w-12 px-4" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSkills.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                                        No skills match your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSkills.map((skill) => {
                                    const isDeleting = deletingSkillId === skill.id;
                                    const isFlagPending = flagPendingSkills[skill.id] !== undefined;
                                    return (
                                        <TableRow key={skill.id}>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <Link
                                                        href={`/settings/skills?skill=${skill.id}`}
                                                        className="truncate font-medium text-foreground hover:underline"
                                                        title={`Open ${skill.name} in skills`}
                                                    >
                                                        {skill.name}
                                                    </Link>
                                                    {skill.source && <SyncedSkillBadge />}
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {skill.createdByEmail ? (
                                                    <span className="block max-w-[14rem] truncate text-sm text-muted-foreground" title={skill.createdByEmail}>
                                                        {skill.createdByEmail}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">Unknown</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <Switch
                                                    checked={skill.autoEnrolled}
                                                    disabled={isFlagPending}
                                                    onCheckedChange={(checked) => void handleFlagChange(skill, "autoEnrolled", checked)}
                                                    aria-label="Auto"
                                                    className={cn(
                                                        "data-[state=unchecked]:bg-muted-foreground/40 data-[state=unchecked]:border-muted-foreground/70",
                                                        "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600",
                                                        "[&>span]:bg-foreground",
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    disabled={isDeleting || isFlagPending}
                                                    onClick={() => setSkillToDelete(skill)}
                                                    aria-label={`Delete ${skill.name}`}
                                                >
                                                    {isDeleting ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2Icon className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>

                    <p className="text-xs text-muted-foreground">
                        {filteredSkills.length} of {orgSkills.length} shared {pluralize(orgSkills.length, "skill")}
                    </p>
                </>
            )}

            <DeleteWorkspaceSkillDialog
                skill={skillToDelete}
                isDeleting={deletingSkillId !== null}
                disabled={skillToDelete ? flagPendingSkills[skillToDelete.id] !== undefined : false}
                onOpenChange={(open) => {
                    if (!open && deletingSkillId === null) {
                        setSkillToDelete(null);
                    }
                }}
                onConfirm={() => {
                    if (skillToDelete && flagPendingSkills[skillToDelete.id] === undefined) {
                        void handleDelete(skillToDelete.id);
                    }
                }}
            />
        </div>
    );
}
