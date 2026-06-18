import { isServiceError } from "@/lib/utils";
import type { ServiceError } from "@/lib/serviceError";
import { deleteOrgAgentSkill, setOrgSkillFlag } from "@/ee/features/chat/skills/actions";
import { sortOrgAgentSkillCatalogItems, type OrgAgentSkillManagementItem } from "@/ee/features/chat/skills/types";

export type OrgSkillFlagKey = "featured" | "autoEnrolled";

export async function deleteWorkspaceSkill<T extends { id: string }>({
    skillId,
    updateOrgSkills,
}: {
    skillId: string;
    updateOrgSkills: (updater: (skills: T[]) => T[]) => void;
}): Promise<ServiceError | null> {
    const result = await deleteOrgAgentSkill(skillId);
    if (isServiceError(result)) {
        return result;
    }

    updateOrgSkills((current) => current.filter((skill) => skill.id !== skillId));
    return null;
}

export async function updateWorkspaceSkillFlag({
    skillId,
    flag,
    checked,
    updateOrgSkills,
}: {
    skillId: string;
    flag: OrgSkillFlagKey;
    checked: boolean;
    updateOrgSkills: (updater: (skills: OrgAgentSkillManagementItem[]) => OrgAgentSkillManagementItem[]) => void;
}): Promise<ServiceError | null> {
    const result = await setOrgSkillFlag({
        skillId,
        data: flag === "featured"
            ? { featured: checked }
            : { autoEnrolled: checked },
    });
    if (isServiceError(result)) {
        return result;
    }

    updateOrgSkills((current) => sortOrgAgentSkillCatalogItems(current.map((item) =>
        item.id === result.id ? result : item,
    )));
    return null;
}
