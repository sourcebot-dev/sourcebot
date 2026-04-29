'use client';

import { CopyIconButton } from "@/app/(app)/components/copyIconButton";
import { FileDiff } from "@/features/git";
import { FileCode } from "lucide-react";
import { useCallback, useMemo } from "react";
import { CommitActionLink } from "../../../components/commitParts";
import { getBrowsePath } from "../../../hooks/utils";
import { computeChangeCounts, DiffStat } from "./diffStat";
import { getFileStatus, StatusBadge } from "./fileStatus";
import { LightweightDiffViewer } from "./lightweightDiffViewer";

const getDisplayPath = (file: FileDiff): string => {
    if (getFileStatus(file) === 'renamed') {
        return `${file.oldPath} → ${file.newPath}`;
    }
    return file.newPath ?? file.oldPath ?? '';
};

interface FileDiffRowProps {
    file: FileDiff;
    yOffset: number;
    repoName: string;
    commitSha: string;
    // Null for the initial commit (no parent).
    parentSha: string | null;
    isCollapsed: boolean;
    onToggleCollapsed: () => void;
}

export const FileDiffRow = ({ file, yOffset, repoName, commitSha, parentSha, isCollapsed, onToggleCollapsed }: FileDiffRowProps) => {
    const status = getFileStatus(file);

    // Deleted files don't exist at the commit, so the link points to the
    // file's last existing state — the old path at the parent commit. For
    // every other status, link to the new path at this commit.
    const isDeleted = status === 'deleted';
    const linkPath = isDeleted ? file.oldPath : file.newPath;
    const linkRevision = isDeleted ? parentSha : commitSha;
    const viewAtCommitHref = linkPath && linkRevision
        ? getBrowsePath({
            repoName,
            revisionName: linkRevision,
            path: linkPath,
            pathType: 'blob',
        })
        : null;

    const onCopyPath = useCallback(() => {
        const pathToCopy = file.newPath ?? file.oldPath;
        if (!pathToCopy) {
            return false;
        }
        navigator.clipboard.writeText(pathToCopy);
        return true;
    }, [file.newPath, file.oldPath]);

    const changeCounts = useMemo(() => computeChangeCounts(file), [file]);

    return (
        <div className="flex flex-col">
            <div
                className="flex flex-row items-center gap-2 py-2 px-3 border-b bg-muted sticky z-10"
                style={{ top: `-${yOffset}px` }}
            >
                <StatusBadge status={status} onToggle={onToggleCollapsed} isCollapsed={isCollapsed} />
                <div className="flex-1 min-w-0 flex flex-row items-center gap-1 overflow-hidden">
                    <code className="text-xs truncate">{getDisplayPath(file)}</code>
                    <CopyIconButton onCopy={onCopyPath} className="flex-shrink-0" />
                </div>
                <DiffStat {...changeCounts} />
                {viewAtCommitHref && (
                    <CommitActionLink
                        href={viewAtCommitHref}
                        label="View code at this commit"
                        icon={<FileCode className="h-3 w-3" />}
                    />
                )}
            </div>
            {!isCollapsed && (
                file.hunks.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                        No textual diff (binary file or empty change).
                    </div>
                ) : (
                    <LightweightDiffViewer
                        hunks={file.hunks}
                        oldPath={file.oldPath}
                        newPath={file.newPath}
                    />
                )
            )}
        </div>
    );
};
