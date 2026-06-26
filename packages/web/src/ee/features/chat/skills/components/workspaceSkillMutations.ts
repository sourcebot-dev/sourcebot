import { isServiceError } from "@/lib/utils";
import type { ServiceError } from "@/lib/serviceError";
import { deleteSharedAgentSkill, setSharedSkillFlag } from "@/ee/features/chat/skills/actions";
import { sortSharedAgentSkillCatalogItems, type SharedAgentSkillManagementItem } from "@/ee/features/chat/skills/types";

export type OrgSkillFlagKey = "autoEnrolled";

export async function deleteWorkspaceSkill<T extends { id: string }>({
    skillId,
    updateOrgSkills,
}: {
    skillId: string;
    updateOrgSkills: (updater: (skills: T[]) => T[]) => void;
}): Promise<ServiceError | null> {
    const result = await deleteSharedAgentSkill(skillId);
    if (isServiceError(result)) {
        return result;
    }

    updateOrgSkills((current) => current.filter((skill) => skill.id !== skillId));
    return null;
}

export async function updateWorkspaceSkillFlag({
    skillId,
    checked,
    updateOrgSkills,
}: {
    skillId: string;
    flag: OrgSkillFlagKey;
    checked: boolean;
    updateOrgSkills: (updater: (skills: SharedAgentSkillManagementItem[]) => SharedAgentSkillManagementItem[]) => void;
}): Promise<ServiceError | null> {
    const result = await setSharedSkillFlag({
        skillId,
        data: { autoEnrolled: checked },
    });
    if (isServiceError(result)) {
        return result;
    }

    updateOrgSkills((current) => sortSharedAgentSkillCatalogItems(current.map((item) =>
        item.id === result.id ? result : item,
    )));
    return null;
}
