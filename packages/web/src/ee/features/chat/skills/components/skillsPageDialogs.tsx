import { AlertTriangleIcon } from "lucide-react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeleteWorkspaceSkillDialog } from "@/ee/features/chat/skills/components/workspaceSkillShared";
import { type DetailSkill } from "@/ee/features/chat/skills/components/skillsPageShared";
import { type AgentSkillSyncField } from "@/ee/features/chat/skills/types";

interface PendingDiscardTransition {
    run: () => void;
}

interface ConfirmSyncOverwrite {
    skill: DetailSkill;
    overwrittenFields: AgentSkillSyncField[];
}

const formatSyncFields = (fields: AgentSkillSyncField[]) =>
    fields.length === 2 ? "description and instructions" : fields[0];

interface SkillsPageDialogsProps {
    pendingDiscard: PendingDiscardTransition | null;
    navGuardActive: boolean;
    confirmSyncOverwrite: ConfirmSyncOverwrite | null;
    confirmMakePersonal: DetailSkill | null;
    confirmPublishSynced: DetailSkill | null;
    confirmDeletePersonal: DetailSkill | null;
    confirmDeleteShared: DetailSkill | null;
    scopePendingId: string | null;
    deletingId: string | null;
    onCancelPendingDiscard: () => void;
    onConfirmPendingDiscard: () => void;
    onCancelNavigation: () => void;
    onConfirmNavigation: () => void;
    onCloseSyncOverwrite: () => void;
    onConfirmSyncOverwrite: (skill: DetailSkill) => void;
    onCloseMakePersonal: () => void;
    onConfirmMakePersonal: (skill: DetailSkill) => void;
    onClosePublishSynced: () => void;
    onConfirmPublishSynced: (skill: DetailSkill) => void;
    onCloseDeletePersonal: () => void;
    onConfirmDeletePersonal: (skill: DetailSkill) => void;
    onCloseDeleteShared: () => void;
    onConfirmDeleteShared: () => void;
}

export function SkillsPageDialogs({
    pendingDiscard,
    navGuardActive,
    confirmSyncOverwrite,
    confirmMakePersonal,
    confirmPublishSynced,
    confirmDeletePersonal,
    confirmDeleteShared,
    scopePendingId,
    deletingId,
    onCancelPendingDiscard,
    onConfirmPendingDiscard,
    onCancelNavigation,
    onConfirmNavigation,
    onCloseSyncOverwrite,
    onConfirmSyncOverwrite,
    onCloseMakePersonal,
    onConfirmMakePersonal,
    onClosePublishSynced,
    onConfirmPublishSynced,
    onCloseDeletePersonal,
    onConfirmDeletePersonal,
    onCloseDeleteShared,
    onConfirmDeleteShared,
}: SkillsPageDialogsProps) {
    return (
        <>
            <AlertDialog
                open={pendingDiscard !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        onCancelPendingDiscard();
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes to this skill. If you continue, your progress will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={onCancelPendingDiscard}>Keep editing</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={onConfirmPendingDiscard}
                        >
                            Discard changes
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={navGuardActive}
                onOpenChange={(open) => {
                    if (!open) {
                        onCancelNavigation();
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
                        <AlertDialogCancel onClick={onCancelNavigation}>Keep editing</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={onConfirmNavigation}
                        >
                            Discard changes
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={confirmSyncOverwrite !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        onCloseSyncOverwrite();
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Overwrite local edits?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The {confirmSyncOverwrite ? formatSyncFields(confirmSyncOverwrite.overwrittenFields) : ""} of{" "}
                            <span className="font-semibold text-foreground">{confirmSyncOverwrite?.skill.name}</span>{" "}
                            {confirmSyncOverwrite?.overwrittenFields.length === 2 ? "have" : "has"} been edited since the skill was last synced. Updating from source will replace those edits with the source file&apos;s content. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={onCloseSyncOverwrite}>Keep my edits</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(event) => {
                                event.preventDefault();
                                if (confirmSyncOverwrite) {
                                    onConfirmSyncOverwrite(confirmSyncOverwrite.skill);
                                }
                            }}
                        >
                            Overwrite and sync
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={confirmMakePersonal !== null}
                onOpenChange={(open) => {
                    if (!open && scopePendingId === null) {
                        onCloseMakePersonal();
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Make Shared Skill Personal</AlertDialogTitle>
                        <AlertDialogDescription>
                            Make <span className="font-semibold text-foreground">{confirmMakePersonal?.name}</span> personal? This removes the <span className="font-mono text-foreground">/{confirmMakePersonal?.slug}</span> command from the shared catalog for everyone and keeps a personal copy for you.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={scopePendingId !== null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={scopePendingId !== null}
                            onClick={(event) => {
                                event.preventDefault();
                                if (confirmMakePersonal) {
                                    onConfirmMakePersonal(confirmMakePersonal);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {scopePendingId !== null ? "Making personal..." : "Make personal"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={confirmPublishSynced !== null}
                onOpenChange={(open) => {
                    if (!open && scopePendingId === null) {
                        onClosePublishSynced();
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Share synced skill with your workspace?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-semibold text-foreground">{confirmPublishSynced?.name}</span>{" "}
                            is synced from{" "}
                            <span className="font-medium text-foreground">{confirmPublishSynced?.source?.repoName}</span>
                            . Sharing publishes the{" "}
                            <span className="font-mono text-foreground">/{confirmPublishSynced?.slug}</span>{" "}
                            command to your workspace and keeps it synced to the source file.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-muted-foreground">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
                        <p>
                            Organization owners who don&apos;t have access to{" "}
                            <span className="font-medium text-foreground">{confirmPublishSynced?.source?.repoName}</span>{" "}
                            will still be able to see and manage this skill from workspace settings. Members without access to the repository won&apos;t see it.
                        </p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={scopePendingId !== null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={scopePendingId !== null}
                            onClick={(event) => {
                                event.preventDefault();
                                if (confirmPublishSynced) {
                                    onConfirmPublishSynced(confirmPublishSynced);
                                }
                            }}
                        >
                            {scopePendingId !== null ? "Sharing..." : "Share skill"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={confirmDeletePersonal !== null}
                onOpenChange={(open) => {
                    if (!open && deletingId === null) {
                        onCloseDeletePersonal();
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Skill</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <span className="font-semibold text-foreground">{confirmDeletePersonal?.name}</span>? This will remove the <span className="font-mono text-foreground">/{confirmDeletePersonal?.slug}</span> command.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deletingId !== null}
                            onClick={(event) => {
                                event.preventDefault();
                                if (confirmDeletePersonal) {
                                    onConfirmDeletePersonal(confirmDeletePersonal);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deletingId !== null ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <DeleteWorkspaceSkillDialog
                skill={confirmDeleteShared}
                isDeleting={deletingId !== null}
                onOpenChange={(open) => {
                    if (!open && deletingId === null) {
                        onCloseDeleteShared();
                    }
                }}
                onConfirm={onConfirmDeleteShared}
            />
        </>
    );
}
