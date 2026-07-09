import {
    type AgentSkillInput,
    type AgentSkillListItem,
    type AgentSkillSourceRef,
    type SharedAgentSkillCatalogItem,
} from "@/ee/features/chat/skills/types";
import { cn } from "@/lib/utils";

export const INSTRUCTIONS_MAX_LENGTH = 20000;

export const SHARED_SKILL_SWITCH_CLASS_NAME = cn(
    "data-[state=unchecked]:bg-muted-foreground/40 data-[state=unchecked]:border-muted-foreground/70",
    "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600",
    "[&>span]:bg-foreground",
);

export const emptySkillForm: AgentSkillInput = {
    name: "",
    slug: "",
    description: "",
    instructions: "",
};

// A normalized view of either a personal or shared skill, so the detail pane can
// render both from one shape.
export interface DetailSkill {
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

export function toDetailFromPersonal(skill: AgentSkillListItem, currentUserEmail: string): DetailSkill {
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

export function toDetailFromShared(skill: SharedAgentSkillCatalogItem, isOwner: boolean): DetailSkill {
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

export function formatUpdatedAt(iso: string): string {
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

export function SkillAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
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
